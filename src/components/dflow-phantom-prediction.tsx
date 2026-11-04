import {useEffect,useState} from "react";
import {CheckCircle2,ExternalLink,ShieldAlert,Wallet,RefreshCw,ArrowRight} from "lucide-react";
import {connectPhantomForDflow,startDflowProofVerification,signDflowPrediction} from "@/lib/dflow-prediction-sign";
import {getDflowPredictionCapability,prepareDflowPredictionOrder,getDflowPredictionStatus} from "@/lib/dflow-predictions";
import {readDflowReceipts,observeDflowReceipt,type DflowReceipt} from "@/lib/dflow-prediction-receipt.mjs";
import {openWalletBrowser,insideWalletApp,isPhoneBrowser} from "@/lib/mobile-wallet";
import type {DflowMarket,DflowOrder} from "@/lib/dflow-prediction-core.mjs";

type Capability={ready:boolean;market:DflowMarket|null;proofVerified:boolean;reason:string};
type OrderReceipt={signature:string;status:string;filled:boolean;amountUsd:number};
const money=(x:number)=>"$"+x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
export function DflowPhantomPrediction({ticker}:{ticker:string}){
 const [wallet,setWallet]=useState("");
 const [cap,setCap]=useState<Capability|null>(null);
 const [side,setSide]=useState<"yes"|"no">("yes");
 const [amount,setAmount]=useState(5);
 const [quote,setQuote]=useState<DflowOrder|null>(null);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [receipt,setReceipt]=useState<OrderReceipt|null>(null);
 const [unresolved,setUnresolved]=useState<DflowReceipt[]>([]);
 const [phone,setPhone]=useState(false);
 useEffect(()=>{setPhone(isPhoneBrowser());},[]);
 useEffect(()=>{setQuote(null);setReceipt(null);setCap(null);setError("");},[ticker,side,amount]);
 useEffect(()=>{
  if(!wallet)return;
  try{setUnresolved(readDflowReceipts(window.localStorage).filter(x=>x.wallet===wallet&&x.ticker===ticker&&["pending","open","pendingClose","unverified"].includes(x.status)));}
  catch{setError("Prediction transaction recovery is unavailable. Check your chain history before reordering.");}
 },[wallet,ticker,receipt]);
 async function run(name:string,job:()=>Promise<void>){
  setBusy(name);setError("");
  try{await job();}catch(e){setError(e instanceof Error?e.message:"DFlow request failed.");}
  finally{setBusy("");}
 }
 async function connect(){
  const address=await connectPhantomForDflow();
  setWallet(address);setQuote(null);
  const result=await getDflowPredictionCapability({data:{wallet:address,ticker}});
  setCap(result);
 }
 async function refresh(){
  if(!wallet)throw Error("Connect Phantom first.");
  const result=await getDflowPredictionCapability({data:{wallet,ticker}});
  setCap(result);setQuote(null);
 }
 async function build(){
  if(!wallet||!cap?.ready)throw Error("DFlow KYC, approved partner access and jurisdiction eligibility are required.");
  const result=await prepareDflowPredictionOrder({data:{wallet,ticker,side,usd:amount}});
  if(!result.ready||!result.order)throw Error(result.reason);
  setQuote(result.order);
 }
 async function sign(){
  if(!quote)throw Error("Review a fresh signed transaction quote first.");
  const result=await signDflowPrediction({wallet,ticker,side,amountUsd:amount,order:quote});
  setReceipt(result);setQuote(null);
 }
 async function reconcile(){
  for(const tx of unresolved){
   const result=await getDflowPredictionStatus({data:{signature:tx.signature,wallet,lastValidBlockHeight:tx.lastValidBlockHeight}});
   if(result.status!=="unavailable")observeDflowReceipt(window.localStorage,tx.signature,result.status);
  }
  setUnresolved(readDflowReceipts(window.localStorage).filter(x=>x.wallet===wallet&&x.ticker===ticker&&["pending","open","pendingClose","unverified"].includes(x.status)));
 }
 return <section className="mt-4 rounded-[22px] border border-emerald-300/20 bg-[#0a1d22] p-4 sm:p-5">
  <p className="font-mono text-[10px] tracking-widest text-emerald-300">SENDA × DFLOW / SOLANA NATIVE PREDICTION ORDERS</p>
  <h3 className="mt-2 text-lg font-semibold">Phantom signs the real Solana transaction</h3>
  <p className="mt-2 text-xs leading-relaxed text-white/60">DFlow can build on-chain Kalshi-linked outcome-token orders that Phantom signs, much like a swap. This is distinct from trades inside Phantom's new U.S. Kalshi account. Senda only exposes this execution lane when official production access, DFlow Proof identity verification, and an approved jurisdiction eligibility check are active.</p>
  <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={()=>void run("wallet",connect)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#071b16] disabled:opacity-40"><Wallet className="size-4"/>{wallet?"Reconnect Phantom":"Connect Phantom"}</button>
    {wallet?<button type="button" disabled={!!busy} onClick={()=>void run("check",refresh)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs"><RefreshCw className="size-4"/>Check eligibility</button>:null}
    {phone&&!insideWalletApp()?<button type="button" onClick={()=>openWalletBrowser("phantom")} className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-3 text-xs">Open Senda in Phantom</button>:null}
  </div>
  {wallet?<p className="mt-2 break-all font-mono text-[10px] text-white/45">Wallet: {wallet}</p>:null}
  {cap?<div className={`mt-3 rounded-xl border p-3 text-xs ${cap.ready?"border-emerald-300/25 bg-emerald-300/5 text-emerald-100":"border-amber-300/20 bg-amber-300/5 text-amber-100"}`}><p className="font-semibold">{cap.ready?"Verified DFlow execution availability":"DFlow trading not yet available"}</p><p className="mt-1 leading-relaxed">{cap.reason}</p><p className="mt-1 text-[11px]">DFlow Proof: {cap.proofVerified?"Verified":"Not verified or not checked"}</p></div>:null}
  {wallet&&cap?.market&&cap.proofVerified===false?<button type="button" disabled={!!busy} onClick={()=>void run("kyc",()=>startDflowProofVerification(wallet))} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-300/30 px-4 text-xs text-amber-200 disabled:opacity-40">Verify your wallet through DFlow Proof <ExternalLink className="size-3"/></button>:null}
  {cap?.ready?<div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
    <p className="text-xs font-semibold">Select a funded outcome</p>
    <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setSide("yes")} className={`min-h-10 rounded-xl border text-xs ${side==="yes"?"border-emerald-300 bg-emerald-300/10":"border-white/10"}`}>YES</button><button type="button" onClick={()=>setSide("no")} className={`min-h-10 rounded-xl border text-xs ${side==="no"?"border-emerald-300 bg-emerald-300/10":"border-white/10"}`}>NO</button></div>
    <label className="mt-3 block text-xs text-white/55">USDC spend · $1–$250<input type="number" min="1" max="250" step=".01" value={amount} onChange={e=>setAmount(Number(e.target.value))} className="mt-1 min-h-10 w-full rounded-xl border border-white/15 bg-[#172a30] px-3"/></label>
    {cap.market?<p className="mt-2 break-all text-[10px] text-white/40">DFlow outcome mint: {side==="yes"?cap.market.yesMint:cap.market.noMint}</p>:null}
    <button type="button" disabled={!!busy} onClick={()=>void run("prepare",build)} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-300 px-3 text-xs font-bold text-[#072018] disabled:opacity-40">Get executable DFlow order</button>
    {quote?<div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-300/5 p-3"><p className="text-xs font-semibold">Review the on-chain transaction before Phantom opens</p><p className="mt-2 text-[11px] text-white/65">{money(amount)} USDC · {side.toUpperCase()} · {quote.executionMode} settlement · minimum {quote.minOutAmount} raw outcome units</p><p className="mt-1 text-[11px] text-amber-100/75">Submitting may lock funds while DFlow liquidity providers fill the order. A Solana signature is not proof of fill.</p><button type="button" disabled={!!busy||Date.now()>quote.quoteExpiry} onClick={()=>void run("sign",sign)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#081f19] disabled:opacity-40">Sign & submit with Phantom <ArrowRight className="size-3"/></button></div>:null}
   </div>:null}
  {receipt?<div className="mt-3 rounded-xl border border-emerald-300/30 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-emerald-200"><CheckCircle2 className="size-4"/>Wallet transaction submitted</p><p className="mt-1 break-all font-mono text-[10px] text-white/50">{receipt.signature}</p><p className="mt-2 text-xs">{receipt.filled?"DFlow confirmed a closed order.":"DFlow fill not yet confirmed. Track its status before retrying."}</p><a target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${receipt.signature}`} className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300">Check Solscan <ExternalLink className="size-3"/></a></div>:null}
  {unresolved.length?<button type="button" disabled={!!busy} onClick={()=>void run("reconcile",reconcile)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs"><RefreshCw className="size-4"/>Reconcile {unresolved.length} pending order(s)</button>:null}
  {error?<p role="alert" className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-xs text-amber-100">{error}</p>:null}
  <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/50"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300"/>This is a separate on-chain DFlow outcome-token integration, not an imported Phantom Predict/Kalshi account. KYC, market restrictions and exchange rules still apply. USDC transfers, wallet signatures and DFlow order settlement are all separate stages. Never burn outcome tokens.</p>
 </section>;
}
