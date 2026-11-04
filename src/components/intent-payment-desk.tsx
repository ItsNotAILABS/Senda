import { useState } from "react";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc, paySol } from "@/lib/solana-pay";
import { parseSolanaIntent,transferReview } from "@/lib/solana-intent.mjs";

type Draft = ReturnType<typeof parseSolanaIntent>;
export function IntentPaymentDesk() {
 const [phrase,setPhrase]=useState("");
 const [draft,setDraft]=useState<Draft|null>(null);
 const [owner,setOwner]=useState("");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState("");
 const [error,setError]=useState("");
 const [approved,setApproved]=useState(false);
 const parse=()=>{setApproved(false);setResult("");setError("");setDraft(parseSolanaIntent(phrase));};
 const connect=async()=>{
  try { const address=await connectPhantom();setOwner(address);setApproved(false); }
  catch(e){setError(e instanceof Error?e.message:"Wallet connection failed");}
 };
 const review=draft?.status==="draft"&&draft.kind==="transfer"?transferReview(draft,owner):null;
 const send=async()=>{
  if(!approved||!draft||draft.status!=="draft"||draft.kind!=="transfer"||review?.status!=="ready-for-confirmation")return;
  setBusy(true);setError("");setResult("");
  try {
   if(draft.asset==="USDC") {
    const tx=await payUsdc({owner,to:draft.destination,usd:Number(draft.amount),memo:"Senda intent approved payment"});
    setResult("Confirmed USDC transfer: "+tx.signature);
   } else {
    const signature=await paySol({owner,to:draft.destination,sol:Number(draft.amount)});
    setResult("Confirmed SOL transfer: "+signature);
   }
   setApproved(false);setDraft(null);
  } catch(e){setError(e instanceof Error?e.message:"Transfer not confirmed");}
  finally{setBusy(false);}
 };
 return <section className="space-y-4 rounded-3xl border border-white/10 bg-[#10131c] p-6 text-white">
  <div><p className="text-xs uppercase tracking-widest text-lime-300">Senda · Solana intents</p>
  <h2 className="text-2xl font-semibold">Tell your wallet what to do</h2>
  <p className="mt-1 text-sm text-white/60">Draft a transaction in plain language. Review it, then Phantom asks you to sign. No agent holds your key.</p></div>
  <label className="block text-sm">Your request
   <input value={phrase} onChange={e=>{setPhrase(e.target.value);setDraft(null);setApproved(false);}} maxLength={240}
    placeholder="send 5 USDC to a Solana wallet address"
    className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 p-3 text-white"/>
  </label>
  <div className="flex flex-wrap gap-2">
   <button type="button" onClick={parse} className="rounded-xl bg-lime-300 px-4 py-2 font-bold text-black">Review intent</button>
   <button type="button" onClick={connect} className="rounded-xl border border-white/20 px-4 py-2">{owner?owner.slice(0,5)+"…"+owner.slice(-5):"Connect Phantom"}</button>
  </div>
  {draft?.status==="unsupported"?<p role="alert" className="text-amber-300">Request not supported: {draft.error}. No transaction was prepared.</p>:null}
  {draft?.status==="draft"&&draft.kind==="swap"?<div className="rounded-xl border border-amber-300/30 p-3">
   <strong>Swap draft only</strong><p className="text-sm text-white/70">A balance-aware Jupiter quote and transaction simulation are required before confirmation. Nothing was signed or sent.</p>
  </div>:null}
  {draft?.status==="draft"&&draft.kind==="transfer"?<div className="space-y-3 rounded-xl border border-white/20 p-4">
   <p className="font-semibold">Review on-chain transfer</p>
   <dl className="grid grid-cols-2 gap-2 text-sm"><dt>Asset</dt><dd>{draft.asset}</dd><dt>Amount</dt><dd>{draft.amount}</dd>
    <dt>Network</dt><dd>Solana mainnet-beta</dd><dt>Recipient</dt><dd className="break-all">{draft.destination}</dd>
    <dt>Sender</dt><dd className="break-all">{owner||"Connect wallet first"}</dd></dl>
   <p className="text-xs text-white/60">Network fee and recipient address must be reviewed in your wallet. Senda will not sign without your approval.</p>
   {review?.status==="ready-for-confirmation"?<label className="flex gap-2 text-sm"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>I checked the amount, address and network.</label>:<p className="text-amber-300">Connect a different sender wallet to proceed.</p>}
   <button type="button" disabled={!approved||busy||review?.status!=="ready-for-confirmation"} onClick={send}
    className="rounded-xl bg-lime-300 px-4 py-2 font-bold text-black disabled:opacity-40">{busy?"Confirming…":"Continue to wallet signature"}</button>
  </div>:null}
  {error?<p role="alert" className="text-red-300">{error}</p>:null}
  {result?<p role="status" className="break-all text-lime-300">{result}</p>:null}
 </section>;
}
