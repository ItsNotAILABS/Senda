import { useState } from "react";
import { getJupiterV2Preview, type JupiterV2Preview } from "@/lib/jupiter-v2-preview";
const SOL="So11111111111111111111111111111111111111112";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export function JupiterV2PreviewPanel(){
 const [inputMint,setInputMint]=useState(SOL);
 const [outputMint,setOutputMint]=useState(USDC);
 const [amount,setAmount]=useState("100000000");
 const [quote,setQuote]=useState<JupiterV2Preview|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const refresh=async()=>{
  setQuote(null);setError("");setLoading(true);
  try{setQuote(await getJupiterV2Preview({data:{inputMint,outputMint,amount}}));}
  catch(e){setError(e instanceof Error?e.message:"No quote available");}
  finally{setLoading(false);}
 };
 const field="mt-1 w-full rounded-xl border border-white/15 bg-black/25 p-2 text-xs text-white";
 return <section className="mb-4 rounded-[22px] border border-lime-300/20 bg-[#0c1523] p-5 text-white">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-lime-300">Jupiter Swap V2 · Meta-Aggregator</p>
    <h2 className="mt-2 text-xl font-semibold">Next-generation route preview</h2>
    <p className="mt-1 max-w-2xl text-xs text-white/55">Metis, JupiterZ, DFlow and OKX compete within Jupiter. This panel requests a live quote without wallet identity; it never creates or submits a swap.</p></div>
   <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/60">Research only</span>
  </div>
  <div className="mt-4 grid gap-3 md:grid-cols-3">
   <label className="text-xs text-white/55">Input mint<input className={field} value={inputMint} onChange={e=>setInputMint(e.target.value.trim())}/></label>
   <label className="text-xs text-white/55">Output mint<input className={field} value={outputMint} onChange={e=>setOutputMint(e.target.value.trim())}/></label>
   <label className="text-xs text-white/55">Amount in smallest token units<input inputMode="numeric" className={field} value={amount} onChange={e=>setAmount(e.target.value.trim())}/></label>
  </div>
  <div className="mt-4 flex flex-wrap items-center gap-3">
   <button type="button" onClick={refresh} disabled={loading} className="rounded-xl bg-lime-300 px-4 py-2 text-xs font-bold text-[#10160a] disabled:opacity-50">{loading?"Fetching live quote…":"Inspect Jupiter V2 route"}</button>
   <span className="text-[11px] text-white/40">Default amount: 0.1 SOL in lamports.</span>
  </div>
  {error?<p role="alert" className="mt-3 text-xs text-amber-200">{error}</p>:null}
  {quote?<div className="mt-4 grid gap-3 rounded-xl border border-white/10 p-3 text-xs md:grid-cols-3" aria-live="polite">
    <div><p className="text-white/45">Selected routing engine</p><strong className="mt-1 block text-lime-200">{quote.router}</strong></div>
    <div><p className="text-white/45">Indicative output (raw units)</p><strong className="mt-1 block font-mono">{quote.outAmount}</strong></div>
    <div><p className="text-white/45">Jupiter fee / observation</p><strong className="mt-1 block">{quote.feeBps} bps · {new Date(quote.observedAt).toLocaleTimeString()}</strong></div>
    <p className="md:col-span-3 text-[11px] text-white/50">A new taker-bound order, exact transaction inspection, and wallet signature are still required to execute. This quote has no fill guarantee.</p>
   </div>:null}
 </section>;
}
