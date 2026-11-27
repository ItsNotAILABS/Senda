import {useEffect,useState} from "react";
import {ShieldCheck,ShieldAlert,RefreshCw,ExternalLink} from "lucide-react";
import {Link} from "@tanstack/react-router";
import {getAgentTreasuryStatus} from "@/lib/agent-treasury-status";
import {useWalletCtx} from "@/lib/wallet-context";

type TreasuryResponse=Awaited<ReturnType<typeof getAgentTreasuryStatus>>;
const showRaw=(value:unknown,decimals:number)=>{
 if(typeof value!=="string"||!/^[0-9]+$/.test(value)||decimals<0||decimals>18)return "—";
 const raw=BigInt(value),base=10n**BigInt(decimals);
 const fraction=(raw%base).toString().padStart(decimals,"0").replace(/0+$/,"");
 return (raw/base).toLocaleString("en-US")+(fraction?"."+fraction:"");
};
/** Read-only, fails closed. This view never grants agent signing or wallet authority. */
export function AgentTreasuryStatus(){
 const api=useWalletCtx();
 const owner=api.w.links.find(x=>x.kind==="phantom"||x.kind==="solana")?.address??"";
 const [seedId,setSeedId]=useState("0");
 const [result,setResult]=useState<TreasuryResponse|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;setResult(null);setError("");
  if(!owner)return()=>{active=false};
  setLoading(true);
  void getAgentTreasuryStatus({data:{owner,seedId:"0"}})
   .then(row=>{if(active)setResult(row)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Treasury source unavailable")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[owner]);
 async function refresh(){
  if(!owner||loading)return;
  if(!/^(?:0|[1-9][0-9]{0,19})$/.test(seedId)){setError("Use a whole-number treasury identifier.");return}
  setError("");setLoading(true);
  try{setResult(await getAgentTreasuryStatus({data:{owner,seedId}}))}
  catch(e){setError(e instanceof Error?e.message:"Could not check treasury status")}
  finally{setLoading(false)}
 }
 const observed=result?.status==="observed"&&result.account?result.account:null;
 const active=observed&&observed.paused===false&&observed.revoked===false;
 const decimals=typeof observed?.decimals==="number"?observed.decimals:6;
 return <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 sm:p-5" aria-label="Agent treasury status">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="font-mono text-[10px] tracking-[.15em] text-violet-300">PARRALAX / AGENT ACCOUNTS</p>
    <h3 className="mt-2 text-lg font-semibold">Governed money for agents</h3>
    <p className="mt-2 max-w-2xl text-xs leading-6 text-white/50">Read-only treasury status for your connected wallet. Limits and guardians belong to the on-chain program, not an editable browser balance. Senda does not currently authorize automated agent spending.</p>
   </div>
   <span className={"inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] "+(
    observed?"border-emerald-300/20 text-emerald-200":"border-amber-300/20 text-amber-200"
   )}>{observed?<ShieldCheck className="size-3.5"/>:<ShieldAlert className="size-3.5"/>}
    {observed?"Chain account observed":loading?"Checking…":result?.status==="not-created"?"No vault created":"Not activated"}
   </span>
  </div>
  <div className="mt-4 flex flex-wrap items-end gap-2">
   <label className="text-[11px] text-white/55">Treasury ID
    <input value={seedId} onChange={e=>setSeedId(e.target.value.trim())} inputMode="numeric"
     className="mt-1 block h-10 w-28 rounded-lg border border-white/15 bg-black/20 px-3 font-mono text-sm text-white outline-none"
     aria-label="Treasury seed identifier" maxLength={20}/>
   </label>
   <button type="button" disabled={!owner||loading} onClick={()=>void refresh()}
    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-semibold text-white/80 disabled:opacity-40">
    <RefreshCw className={"size-3.5 "+(loading?"animate-spin":"")}/>{loading?"Checking…":"Check treasury"}
   </button>
   <Link to="/agents" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs text-violet-200">
    Agent workspace <ExternalLink className="size-3"/>
   </Link>
  </div>
  {error?<p role="alert" className="mt-3 text-xs text-amber-200">{error}</p>:null}
  {result?.reason?<p className="mt-3 text-xs leading-6 text-white/50">{result.reason}</p>:null}
  {observed?<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
   {([
    ["Vault balance",showRaw(observed.balanceMinor,decimals)+" tokens"],
    ["Per transaction",showRaw(observed.perTxCapMinor,decimals)],
    ["Daily limit",showRaw(observed.dailyCapMinor,decimals)],
    ["Lifetime limit",showRaw(observed.lifetimeCapMinor,decimals)]
   ] as const).map(([name,value])=><div key={name} className="rounded-xl border border-white/10 bg-black/20 p-3">
    <p className="text-[10px] text-white/45">{name}</p>
    <p className="mt-1 break-all font-mono text-sm">{value}</p>
   </div>)}
   <p className="col-span-2 text-[11px] leading-5 text-white/50 sm:col-span-4">
    {active?"Account policy appears active on the observed chain snapshot; Senda signing remains disabled.":
     "Vault is paused or revoked. No agent payment authority is available."}
    {" · "}Network: {result?.network} · Slot {String(observed.slot??"unknown")} · This data can change after the observation.
   </p>
  </div>:null}
  <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-5 text-white/35">
   A treasury observation is not a bank account, FDIC-insured deposit, approved payment instruction or permission for an AI agent to spend. Actual owner controls (create, deposit, pause, revoke and withdraw) require a verified deployed program and owner signatures.
  </p>
 </section>;
}
