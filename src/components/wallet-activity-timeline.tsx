import {useEffect,useMemo,useState} from "react";
import {ArrowUpRight,CheckCircle2,Clock3,RefreshCw,ShieldAlert,Wallet} from "lucide-react";
import {connectPhantom} from "@/lib/phantom";
import {useWalletCtx} from "@/lib/wallet-context";
import {getWalletActivity} from "@/lib/wallet-activity";
import {listTransactions,type JournalEntry} from "@/lib/tx-journal.mjs";
import {mergeActivityWithRecovery,type ActivityCursor,type WalletActivityRow} from "@/lib/wallet-activity-core.mjs";
import {TransactionRecovery} from "@/components/transaction-recovery";

const short=(value:string)=>value.slice(0,6)+"…"+value.slice(-6);
function amount(raw:string){
 try{
  const n=BigInt(raw),abs=n<0n?-n:n;
  const whole=(abs/1000000n).toLocaleString("en-US");
  const fraction=(abs%1000000n).toString().padStart(6,"0").replace(/0+$/,"");
  return (n<0n?"−":"+")+whole+(fraction?"."+fraction:"")+" USDC";
 }catch{return "Amount unavailable";}
}
function state(status:WalletActivityRow["status"]){
 switch(status){
  case "finalized":return {name:"Finalized",tone:"text-emerald-200",icon:"check"};
  case "confirmed":return {name:"Confirmed · finality pending",tone:"text-cyan-200",icon:"clock"};
  case "processing":return {name:"Processing · not confirmed",tone:"text-amber-200",icon:"clock"};
  case "failed":return {name:"Failed on-chain",tone:"text-rose-200",icon:"alert"};
  case "pending":return {name:"Submitted · not yet verified",tone:"text-amber-200",icon:"clock"};
  default:return {name:"Unverified · inspect explorer",tone:"text-amber-200",icon:"alert"};
 }
}
function mergePages(previous:WalletActivityRow[],next:WalletActivityRow[]){
 const map=new Map(previous.map(x=>[x.signature,x]));
 for(const row of next)map.set(row.signature,row);
 return [...map.values()].sort((a,b)=>(b.blockTime??Math.floor(b.observedAt/1000))-
  (a.blockTime??Math.floor(a.observedAt/1000))||(b.slot??0)-(a.slot??0));
}
/** Chain history is fetched from mainnet RPC; local journal only annotates/recoveries. */
export function WalletActivityTimeline(){
 const api=useWalletCtx();
 const owner=api.w.links.find(x=>x.kind==="phantom"||x.kind==="solana")?.address??"";
 const [chain,setChain]=useState<WalletActivityRow[]>([]);
 const [local,setLocal]=useState<JournalEntry[]>([]);
 const [cursor,setCursor]=useState<ActivityCursor|null>(null);
 const [loading,setLoading]=useState(false);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const [checking,setChecking]=useState(false);
 const [error,setError]=useState("");
 const [journalError,setJournalError]=useState("");
 const [syncedAt,setSyncedAt]=useState<number|null>(null);
 const [diagnostics,setDiagnostics]=useState<{durationMs:number;missingEnrichments:number}|null>(null);
 const [connecting,setConnecting]=useState(false);
 useEffect(()=>{
  if(!owner){setLocal([]);setJournalError("");return;}
  function read(){
   try{setLocal(listTransactions(window.localStorage,owner));setJournalError("")}
   catch(e){setLocal([]);setJournalError(e instanceof Error?e.message:"Local transaction recovery records are unreadable.")}
  }
  read();window.addEventListener("storage",read);window.addEventListener("senda-book",read);
  const interval=window.setInterval(read,5000);
  return()=>{window.removeEventListener("storage",read);window.removeEventListener("senda-book",read);window.clearInterval(interval)}
 },[owner]);
 useEffect(()=>{
  let active=true;
  setChain([]);setCursor(null);setSyncedAt(null);setDiagnostics(null);setError("");
  if(!owner)return()=>{active=false};
  setLoading(true);
  void getWalletActivity({data:{owner,limit:20}})
   .then(result=>{if(active){setChain(result.rows);setCursor(result.nextCursor);setSyncedAt(result.observedAt);setDiagnostics(result.diagnostics)}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Solana activity is unavailable.")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[owner]);
 const rows=useMemo(()=>{
  if(!owner)return [];
  try{return mergeActivityWithRecovery({owner,chain,local})}
  catch{return chain}
 },[owner,chain,local]);
 const unknown=rows.filter(x=>x.status==="unverified"||x.status==="pending"||x.status==="processing").length;
 async function connect(){
  setConnecting(true);setError("");
  try{
   const address=await connectPhantom();
   if(!api.w.links.some(x=>x.address===address)){
    const result=api.linkChain(address,"Phantom","phantom");
    if(!result.ok&&result.error!=="Already linked.")throw Error(result.error||"Wallet link was not saved");
   }
  }catch(e){setError(e instanceof Error?e.message:"Cannot connect the wallet")}
  finally{setConnecting(false)}
 }
 async function refresh(){
  if(!owner||checking||loading||loadingOlder)return;
  setChecking(true);setError("");
  try{
   const result=await getWalletActivity({data:{owner,limit:20}});
   setChain(previous=>mergePages(previous,result.rows));
   // Retain deeper pagination cursor already visited unless this is the first page.
   setCursor(previous=>previous??result.nextCursor);
   setSyncedAt(result.observedAt);setDiagnostics(result.diagnostics);
  }catch(e){setError(e instanceof Error?e.message:"Failed to verify the chain.")}
  finally{setChecking(false)}
 }
 async function loadOlder(){
  if(!owner||!cursor||loadingOlder||loading||checking)return;
  setLoadingOlder(true);setError("");
  try{
   const result=await getWalletActivity({data:{owner,cursor,limit:20}});
   setChain(previous=>mergePages(previous,result.rows));
   setCursor(result.nextCursor);
   setSyncedAt(result.observedAt);setDiagnostics(result.diagnostics);
  }catch(e){setError(e instanceof Error?e.message:"Could not load older chain history")}
  finally{setLoadingOlder(false)}
 }
 return <section className="space-y-4">
  <div className="rounded-[24px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,#173c4d,#0c1523_55%,#080d16)] p-5 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><p className="font-mono text-[10px] tracking-[.18em] text-cyan-300">SENDA MONEY / CHAIN ACTIVITY</p>
     <h2 className="mt-2 text-2xl font-semibold">Every payment has a trail.</h2>
     <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Read Solana wallet and USDC account history directly from the chain. Pending transactions stay visible from this browser's recovery journal. Senda does not hold a deposit or card balance.</p>
    </div>
    {owner?<button type="button" disabled={checking||loading||loadingOlder} onClick={()=>void refresh()}
     className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-300/20 px-4 text-xs font-semibold text-cyan-200 disabled:opacity-40">
     <RefreshCw className={"size-3.5 "+(checking?"animate-spin":"")}/>{checking?"Checking…":"Refresh chain"}
    </button>:<button type="button" disabled={connecting} onClick={()=>void connect()}
     className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-semibold text-[#061521] disabled:opacity-40">
     <Wallet className="size-4"/>{connecting?"Connecting…":"Connect Phantom"}
    </button>}
   </div>
   <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] text-white/50">
    <span className="rounded-full border border-white/10 px-3 py-2">Solana mainnet</span>
    <span className="rounded-full border border-white/10 px-3 py-2">{owner?short(owner):"No linked Solana wallet"}</span>
    <span className="rounded-full border border-white/10 px-3 py-2">{syncedAt?"Source checked "+new Date(syncedAt).toLocaleTimeString():"No verified source sync"}</span>
    {diagnostics?<span className="rounded-full border border-white/10 px-3 py-2">RPC {diagnostics.durationMs} ms · {diagnostics.missingEnrichments} details unavailable</span>:null}
    {unknown>0?<span className="rounded-full border border-amber-300/25 px-3 py-2 text-amber-200">{unknown} to verify</span>:null}
   </div>
  </div>
  {error?<p role="alert" className="rounded-xl border border-amber-300/20 bg-amber-300/[.05] p-3 text-sm text-amber-100">{error}</p>:null}
  {journalError?<p role="alert" className="rounded-xl border border-rose-300/20 p-3 text-sm text-rose-200">{journalError} Do not retry an uncertain send until it is checked.</p>:null}
  {owner?<TransactionRecovery owner={owner}/>:null}
  <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
   <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
    <div><h3 className="text-base font-semibold">Wallet history</h3>
     <p className="mt-1 text-[11px] text-white/40">Chain-backed observations · Local send notes identified separately · Up to 20 additional signatures per page</p>
    </div>
    <span className="font-mono text-xs text-white/45">{rows.length} visible</span>
   </div>
   {!owner?<div className="px-5 py-12 text-center text-sm text-white/50">Connect your wallet to inspect its public transaction history.</div>:
   loading&&!rows.length?<div className="px-5 py-12 text-center text-sm text-white/50">Reading verified Solana history…</div>:
   !rows.length?<div className="px-5 py-12 text-center text-sm text-white/50">No wallet transactions have been observed in this view. If the RPC is unavailable, refresh when it recovers.</div>:
   <ul className="divide-y divide-white/[.065]">
    {rows.map(item=>{
     const verdict=state(item.status),delta=item.deltaUsdcRaw;
     const title=delta?(BigInt(delta)<0n?"USDC out":"USDC in"):
      item.source==="local-recovery-journal"?"Locally recorded transaction":"Wallet transaction";
     return <li key={item.signature} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0 space-y-1">
       <p className="text-sm font-semibold">{title}
        {delta?<span className="ml-2 font-mono text-sm text-white/70">{amount(delta)}</span>:null}
       </p>
       <p className={"flex items-center gap-1.5 text-[11px] "+verdict.tone}>
        {verdict.icon==="check"?<CheckCircle2 className="size-3.5"/>:
         verdict.icon==="clock"?<Clock3 className="size-3.5"/>:<ShieldAlert className="size-3.5"/>}
        {verdict.name}
        <span className="text-white/30">· {item.source==="solana-rpc"?"RPC observation":"Local recovery journal"}</span>
       </p>
       <p className="font-mono text-[10px] text-white/35">
        {item.blockTime?new Date(item.blockTime*1000).toLocaleString():new Date(item.observedAt).toLocaleString()}
        {item.slot?" · slot "+item.slot:""}
        {item.localDestination?" · intended to "+short(item.localDestination):""}
       </p>
      </div>
      <a href={"https://solscan.io/tx/"+item.signature} target="_blank" rel="noopener noreferrer"
       className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 font-mono text-[11px] text-cyan-200">
       {short(item.signature)}<ArrowUpRight className="size-3.5"/>
      </a>
     </li>
    })}
   </ul>}
   {owner&&cursor?<div className="border-t border-white/10 p-3 text-center">
    <button type="button" onClick={()=>void loadOlder()} disabled={loadingOlder||checking||loading}
     className="min-h-10 rounded-full border border-white/15 px-5 text-xs font-semibold text-white/80 disabled:opacity-40">
     {loadingOlder?"Loading older receipts…":"Load older activity"}
    </button>
   </div>:null}
   <p className="border-t border-white/10 px-4 py-3 text-[10px] leading-5 text-white/35">
    Coverage: the connected wallet address and its canonical USDC token account. Other token accounts, custodial activity, off-chain payouts and historic third-party wallets are not fully indexed. Only chain-reported USDC deltas are displayed as movements. A signature alone does not prove a particular recipient or asset; inspect the linked transaction for details.
   </p>
  </div>
 </section>
}
