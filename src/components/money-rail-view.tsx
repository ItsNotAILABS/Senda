import {useState} from "react";
import {Link} from "@tanstack/react-router";
import {ArrowRight,Wallet,Landmark,CreditCard,ShieldAlert,Copy,CheckCircle2,Share2} from "lucide-react";
import {connectPhantom} from "@/lib/phantom";
import {usdcPayRequest,findReferencedUsdcPayment} from "@/lib/solana-pay";
import {usdToCents,PUBLIC_MEMO_NOTICE} from "@/lib/friend-payments.mjs";

export function MoneyRailView({mode}:{mode:"request"|"add"|"exchange"|"nearby"}){
 const [wallet,setWallet]=useState("");
 const [amount,setAmount]=useState("");
 const [memo,setMemo]=useState("");
 const [error,setError]=useState("");
 const [link,setLink]=useState("");
 const [request,setRequest]=useState<{reference:string;cents:number}|null>(null);
 const [paidNote,setPaidNote]=useState("");
 const [busy,setBusy]=useState(false);
 async function connect(){setBusy(true);setError("");try{setWallet(await connectPhantom());}catch(e){setError(e instanceof Error?e.message:"Wallet unavailable.");}finally{setBusy(false)}}
 function makeRequest(){
  try{
   if(!wallet)throw Error("Connect a receiving wallet first.");
   const cents=usdToCents(amount);
   const {url,reference}=usdcPayRequest(wallet,cents,memo);
   setLink(url);setRequest({reference,cents});setPaidNote("");setError("");
  }catch(e){setLink("");setRequest(null);setError(e instanceof Error?e.message:"Invalid payment request.");}
 }
 async function checkPaid(){
  if(!request||!wallet)return;
  setBusy(true);
  try{
   const out=await findReferencedUsdcPayment(wallet,request.cents,request.reference);
   setPaidNote(out.paid?`Paid in full on Solana: ${out.signature}`:out.reason);
  }catch(e){setPaidNote(e instanceof Error?e.message:"Could not check Solana right now.");}
  finally{setBusy(false);}
 }
 const heading={request:"Request money",add:"Add money",exchange:"Convert money",nearby:"Pay someone nearby"}[mode];
 return <div className="mx-auto max-w-[820px] space-y-4">
  <header className="rounded-[24px] border border-cyan-300/15 bg-[#101927] p-5 sm:p-6">
   <p className="font-mono text-[11px] tracking-widest text-cyan-300">SENDA / MONEY</p>
   <h1 className="mt-2 text-3xl font-semibold">{heading}</h1>
   <p className="mt-2 text-sm leading-relaxed text-white/55">{mode==="request"?"Create a genuine Solana USDC payment request. No money is credited until someone signs and the transfer confirms.":mode==="add"?"Fund Senda through an actually connected wallet today. Debit-card and bank funding are being built behind approved processors—no synthetic cash credits.":mode==="exchange"?"Use the live wallet quote router for token conversion. Currency pockets shown elsewhere are not bank accounts or verified FX balances.":"Share a verified wallet address and sign the transfer. Nearby phones or handles are not an authenticated payment network."}</p>
  </header>
  {mode==="request"?<section className="space-y-4 rounded-[22px] border border-white/10 bg-[#101825] p-5">
   <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{wallet?wallet.slice(0,7)+"…"+wallet.slice(-6):"No receiving wallet"}</p><button type="button" disabled={busy} onClick={()=>void connect()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs"><Wallet className="size-4"/>Connect wallet</button></div>
   <label className="block text-xs text-white/60">Request amount in USD<input className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/20 px-4 font-mono text-lg" inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setLink("");setRequest(null)}} placeholder="25.00"/></label>
   <label className="block text-xs text-white/60">Reference (optional)<input className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/20 px-4" value={memo} maxLength={80} onChange={e=>{setMemo(e.target.value);setLink("");setRequest(null)}} placeholder="Dinner"/></label>
   <p className="text-[11px] leading-relaxed text-amber-100/60">{PUBLIC_MEMO_NOTICE}</p>
   <button onClick={makeRequest} type="button" className="min-h-12 w-full rounded-xl bg-cyan-300 font-semibold text-[#061521]">Create actual USDC request</button>
   {link?<div className="space-y-2 rounded-xl border border-cyan-300/20 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><CheckCircle2 className="size-4"/>Payment request created · not paid</p><p className="break-all font-mono text-[11px] text-white/50">{link}</p><button type="button" onClick={()=>void navigator.clipboard.writeText(link)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs"><Copy className="size-3"/>Copy payment link</button>
    {request?<p className="break-all font-mono text-[10px] text-white/40">Reference {request.reference}</p>:null}
    <button type="button" disabled={busy||!request} onClick={()=>void checkPaid()} className="ml-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs disabled:opacity-40">Check if paid</button>
    {paidNote?<p role="status" className="text-xs text-white/60">{paidNote}</p>:null}</div>:null}
  </section>:<section className="rounded-[22px] border border-white/10 bg-[#101825] p-5">
   <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-cyan-300/20 p-4"><Wallet className="size-5 text-cyan-300"/><h3 className="mt-2 font-semibold">USDC with Phantom</h3><p className="mt-2 text-xs text-white/50">Wallet-owned stablecoins, wallet-signed transfers. No bank balance is manufactured.</p><Link to="/payments" className="mt-4 inline-flex items-center gap-2 text-xs text-cyan-200">Open Send <ArrowRight className="size-3"/></Link></div><div className="rounded-xl border border-white/10 p-4"><CreditCard className="size-5 text-white/40"/><h3 className="mt-2 font-semibold">Debit card and bank</h3><p className="mt-2 text-xs text-white/50">Requires real authorization, funds settlement, identity checks, risk limits, and a licensed processing partner. Not available as a completed transfer yet.</p><span className="mt-4 inline-block rounded-full border border-amber-300/20 px-2 py-1 text-[11px] text-amber-200">Integration needed</span></div></div>
   {mode==="exchange"?<Link to="/wallet" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-[#061420]">Open live wallet conversion<ArrowRight className="size-4"/></Link>:null}
  </section>}
  {error?<p role="alert" className="rounded-xl border border-rose-300/20 p-3 text-xs text-rose-200">{error}</p>:null}
  <p className="flex gap-2 rounded-xl border border-white/10 p-4 text-xs leading-relaxed text-white/50"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300"/>Senda will never call a local accounting change a bank payment. Actual delivery requires a verified network or provider receipt.</p>
 </div>;
}
