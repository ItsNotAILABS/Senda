import {useEffect,useState} from "react";
import {CheckCircle2,ExternalLink,ShieldCheck,Wallet,AlertTriangle} from "lucide-react";
import {signPhantomPredictionResearch,type PhantomResearchReceipt} from "@/lib/phantom-prediction-sign";
import {insideWalletApp,isPhoneBrowser,openWalletBrowser} from "@/lib/mobile-wallet";

export function PhantomPredictBridge({ticker,side,contracts,grossUsd,quotedAt}:{ticker:string;side:"yes"|"no";contracts:number;grossUsd:number;quotedAt:number}){
 const [busy,setBusy]=useState(false);
 const [receipt,setReceipt]=useState<PhantomResearchReceipt|null>(null);
 const [error,setError]=useState("");
 const [launchError,setLaunchError]=useState("");
 const [inPhone,setInPhone]=useState(false);
 useEffect(()=>{setInPhone(isPhoneBrowser());},[]);
 useEffect(()=>{setReceipt(null);setError("");},[ticker,side,contracts,grossUsd,quotedAt]);
 async function sign(){
  setBusy(true);setError("");setReceipt(null);
  try{const result=await signPhantomPredictionResearch({ticker,side,contracts,grossUsd,quotedAt});setReceipt(result);}
  catch(e){setError(e instanceof Error?e.message:"Phantom signature failed or was declined.");}
  finally{setBusy(false);}
 }
 function open(){
  try{setLaunchError("");openWalletBrowser("phantom");}catch(e){setLaunchError(e instanceof Error?e.message:"Could not open Phantom.");}
 }
 return <section className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[.045] p-4">
  <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-200"><Wallet className="size-4"/>Phantom wallet connection</h3>
  <p className="mt-2 text-xs leading-relaxed text-white/60">Sign this **research acknowledgement** using your actual Phantom wallet. The signature is verified locally and stays in this page. It does not place a prediction bet or authorize Senda to act on your Kalshi account.</p>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" disabled={busy} onClick={()=>void sign()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-[#06121e] disabled:opacity-40"><ShieldCheck className="size-4"/>{busy?"Approve in Phantom…":"Sign research preview with Phantom"}</button>
   {inPhone&&!insideWalletApp()?<button type="button" onClick={open} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs">Open Senda in Phantom <ExternalLink className="size-3"/></button>:null}
  </div>
  {error?<p role="alert" className="mt-3 rounded-lg border border-amber-300/20 p-3 text-xs text-amber-200">{error}</p>:null}
  {launchError?<p role="alert" className="mt-2 text-xs text-amber-200">{launchError}</p>:null}
  {receipt?<div className="mt-3 rounded-xl border border-cyan-300/20 bg-black/20 p-3">
    <p className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><CheckCircle2 className="size-4"/>Phantom signature verified</p>
    <p className="mt-2 break-all font-mono text-[10px] text-white/55">Wallet: {receipt.wallet}</p>
    <p className="mt-1 break-all font-mono text-[10px] text-white/55">Signature: {receipt.signature}</p>
    <p className="mt-2 text-xs leading-relaxed text-white/60">{receipt.notice}</p>
  </div>:null}
  <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-amber-100/70"><AlertTriangle className="mt-0.5 size-4 shrink-0"/>To actually trade the event contract, use Phantom mobile → Predict → review the live quote and fees → confirm there. Senda cannot submit Kalshi orders with a Phantom signMessage signature. Your wallet signature is not venue order authorization.</p>
 </section>;
}
