import {useEffect,useMemo,useState} from "react";
import {ArrowRight,CheckCircle2,Copy,ExternalLink,LockKeyhole,ShieldAlert,Wallet,UserRound,Landmark,CreditCard} from "lucide-react";
import {toast} from "sonner";
import {connectPhantom} from "@/lib/phantom";
import {payUsdc} from "@/lib/solana-pay";
import {quoteFriendPayment,validateFriendDestination,FRIEND_RAILS} from "@/lib/friend-payments.mjs";

const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
export function FriendsMoneyDesk(){
 const [wallet,setWallet]=useState("");
 const [destination,setDestination]=useState("");
 const [amount,setAmount]=useState("");
 const [note,setNote]=useState("");
 const [verified,setVerified]=useState(false);
 const [review,setReview]=useState(false);
 const [busy,setBusy]=useState(false);
 const [signature,setSignature]=useState("");
 const [reference,setReference]=useState("");
 const [error,setError]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const recipient=useMemo(()=>validateFriendDestination(destination),[destination]);
 const quote=useMemo(()=>quoteFriendPayment({recipient:destination,amount,wallet,verified,note}),[destination,amount,wallet,verified,note]);
 useEffect(()=>{setVerified(false);setReview(false);setSignature("");},[destination]);
 useEffect(()=>{setReview(false);setSignature("");},[amount,note,wallet]);
 async function connect(){
  setBusy(true);setError("");
  try{const address=await connectPhantom();setWallet(address);}
  catch(e){setError(e instanceof Error?e.message:"Could not connect wallet.");}
  finally{setBusy(false);}
 }
 async function send(){
  if(busy||uncertain||!review||!quote.ready||!quote.to||!quote.usd)return;
  setBusy(true);setError("");setSignature("");
  try{
   const result=await payUsdc({owner:wallet,to:quote.to,usd:quote.usd,note:note.trim()||"Senda friend payment"});
   setSignature(result.signature);setReference(result.reference);setReview(false);
   toast.success("USDC transfer confirmed on Solana.");
  }catch(e){
   const message=e instanceof Error?e.message:"The transfer could not be verified.";
   setError(message);
   // A wallet may have broadcast a transaction before the confirmation request fails.
   // Do not encourage automatic resubmission when the outcome is uncertain.
   setUncertain(/confirm|pending|timeout|submitted|broadcast|signature|receipt|network|status/i.test(message));
  }finally{setBusy(false);}
 }
 return <div className="mx-auto max-w-[960px] space-y-4 text-white">
  <section className="rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,#184a54,#101927_45%,#0a101c)] p-5 sm:p-7">
   <p className="font-mono text-[11px] tracking-[.18em] text-cyan-300">SENDA / PAY FRIENDS</p>
   <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Send dollars. Not complexity.</h1>
   <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">Enter a dollar amount and a verified recipient wallet. Senda sends the equivalent amount of native USDC on Solana, signed by your Phantom wallet. No Senda-held funds and no invented cash balance.</p>
   <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-[11px] text-cyan-200">USD displayed · USDC delivered</span><span className="rounded-full border border-white/15 px-3 py-2 text-[11px] text-white/55">Recipient must have a Solana wallet</span></div>
  </section>
  <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
   <section className="space-y-4 rounded-[22px] border border-white/10 bg-[#101825] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-white/50">Pay from</p><p className="mt-1 text-sm font-semibold">{wallet?wallet.slice(0,6)+"…"+wallet.slice(-6):"Your Phantom wallet"}</p></div><button type="button" onClick={()=>void connect()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm disabled:opacity-40"><Wallet className="size-4"/>{wallet?"Change wallet":"Connect Phantom"}</button></div>
    <label className="block"><span className="text-xs font-medium text-white/65">Friend's wallet address</span><input className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0b111d] px-4 text-sm outline-none focus:border-cyan-300/50" value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Their Solana address (not an @handle yet)" autoComplete="off" spellCheck={false}/></label>
    <p className="flex gap-2 text-xs leading-relaxed text-white/50"><UserRound className="mt-0.5 size-4 shrink-0"/>{recipient.reason}</p>
    {recipient.kind==="wallet"?<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[.045] p-3 text-xs leading-relaxed text-white/70"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} className="mt-0.5"/>I independently confirmed this full wallet address belongs to my friend. Transfers cannot be reversed.</label>:null}
    <label className="block"><span className="text-xs font-medium text-white/65">Amount in USD</span><div className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-[#0b111d] px-4"><span className="font-mono text-3xl">$</span><input className="min-h-16 w-full bg-transparent font-mono text-3xl outline-none" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></div></label>
    <div className="flex flex-wrap gap-2">{[5,10,25,50,100].map(n=><button type="button" key={n} onClick={()=>setAmount(String(n))} className="min-h-9 rounded-full border border-white/15 px-4 font-mono text-xs hover:border-cyan-300/40">${n}</button>)}</div>
    <label className="block"><span className="text-xs font-medium text-white/65">Message (optional)</span><input className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0b111d] px-4 text-sm outline-none" value={note} onChange={e=>setNote(e.target.value)} maxLength={80} placeholder="For dinner, tickets, groceries…"/></label>
    {quote.ready?<div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4 text-xs"><p className="flex justify-between"><span className="text-white/50">Send</span><strong>{money(quote.usd!)}</strong></p><p className="flex justify-between"><span className="text-white/50">Recipient receives</span><strong>{quote.usd!.toFixed(2)} USDC</strong></p><p className="flex justify-between"><span className="text-white/50">Chain</span><span>Solana Mainnet</span></p><p className="text-amber-100/65">Additional network fees are shown in Phantom. The recipient receives crypto, not bank dollars.</p></div>:<p className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs text-amber-100">{quote.reason}</p>}
    {quote.ready?<label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/>I've reviewed the amount, asset and destination.</label>:null}
    <button type="button" disabled={busy||!quote.ready||!review||uncertain} onClick={()=>void send()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-[#08141e] disabled:opacity-40">{busy?"Confirming in Phantom…":uncertain?"Check previous transfer before retrying":"Review and send with Phantom"}<ArrowRight className="size-4"/></button>
    {error?<p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-100">{error}</p>:null}
    {uncertain?<p className="rounded-xl border border-amber-300/20 p-3 text-xs text-amber-100">Transfer status is uncertain. Check wallet activity and Senda's transaction recovery view before retrying. Reloading does not reverse a broadcast transaction.</p>:null}
    {signature?<div role="status" className="rounded-xl border border-cyan-300/25 bg-cyan-300/[.05] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-cyan-200"><CheckCircle2 className="size-4"/>Confirmed USDC transfer</p><p className="mt-2 break-all font-mono text-[11px] text-white/55">{signature}</p><a target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${signature}`} className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-200">View transaction <ExternalLink className="size-4"/></a></div>:null}
   </section>
   <aside className="space-y-3">
    <div className="rounded-[22px] border border-white/10 bg-[#101825] p-4"><p className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4 text-cyan-300"/>How Senda routes your money</p><p className="mt-2 text-xs leading-relaxed text-white/55">One dollars-first interface. For now, the only enabled money-moving route is real wallet-to-wallet USDC. Adding a debit card does not fund a balance until a card processor actually settles it.</p></div>
    {FRIEND_RAILS.map(rail=><div key={rail.id} className="rounded-xl border border-white/10 bg-[#0d1420] p-3"><p className="flex items-center justify-between gap-2 text-xs font-semibold">{rail.label}<span className={`rounded-full border px-2 py-1 font-mono text-[10px] ${rail.status==="available"?"border-cyan-300/30 text-cyan-200":"border-white/15 text-white/45"}`}>{rail.status==="available"?"Wallet live":"Not connected"}</span></p><p className="mt-2 text-[11px] text-white/45">{rail.finality}</p></div>)}
    <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-100/60"><ShieldAlert className="mt-0.5 size-4 shrink-0"/>Bank delivery, debit-card funding and sending by phone or @handle require real issuer/payment partners and verified recipient identity. They cannot be enabled by quietly changing an on-screen balance.</p>
   </aside>
  </div>
 </div>;
}
