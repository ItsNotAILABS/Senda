import {useState} from "react";
import {compareLiquifyRoutes,type LiquifyV2Comparison} from "@/lib/liquify-v2";
const W_SOL="So11111111111111111111111111111111111111112";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export function LiquifyRouteCompare(){
 const [inputMint,setInputMint]=useState(USDC);
 const [outputMint,setOutputMint]=useState(W_SOL);
 const [amount,setAmount]=useState("10000000");
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [result,setResult]=useState<LiquifyV2Comparison|null>(null);
 const compare=async()=>{
  setResult(null);setError("");setLoading(true);
  try{setResult(await compareLiquifyRoutes({data:{inputMint,outputMint,amount}}));}
  catch(e){setError(e instanceof Error?e.message:"Quote providers unavailable");}
  finally{setLoading(false);}
 };
 const field="mt-1 w-full min-w-0 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs text-white";
 return <section className="mb-5 space-y-4 rounded-2xl border border-cyan-300/20 bg-[#0c1523] p-4 text-white">
  <div>
   <p className="text-[11px] font-mono uppercase tracking-widest text-cyan-300">Liquify V2 / research</p>
   <h2 className="mt-1 text-xl font-semibold">Compare actual venue responses</h2>
   <p className="mt-1 text-xs text-white/55">Any distinct Solana token mints. An independent provider only appears when a separate service is configured and returns a fresh verified-format quote. This does not place orders.</p>
  </div>
  <div className="grid gap-3 md:grid-cols-3">
   <label className="text-xs text-white/60">Input mint<input aria-label="Input mint" value={inputMint} onChange={e=>setInputMint(e.target.value.trim())} className={field}/></label>
   <label className="text-xs text-white/60">Output mint<input aria-label="Output mint" value={outputMint} onChange={e=>setOutputMint(e.target.value.trim())} className={field}/></label>
   <label className="text-xs text-white/60">Input raw units<input aria-label="Input raw units" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value.trim())} className={field}/></label>
  </div>
  <div className="flex flex-wrap items-center gap-3">
   <button type="button" onClick={compare} disabled={loading} className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-[#06131b] disabled:opacity-40">{loading?"Checking…":"Compare routes"}</button>
   <span className="text-[11px] text-white/50">Example: 10,000,000 USDC minor units = 10 USDC. Other mints use their actual decimals.</span>
  </div>
  {error?<p role="alert" className="text-xs text-amber-200">{error}</p>:null}
  {result?<div className="space-y-3" aria-live="polite">
   <p className="text-xs text-white/60">{result.routes.length} independent source response{result.routes.length===1?"":"s"} · {result.rejected.length} unavailable · never a signed swap</p>
   {result.routes.map(route=><div key={route.venue} className="grid gap-2 rounded-xl border border-white/10 p-3 text-xs sm:grid-cols-[1fr_1fr_1fr]">
    <span className="font-semibold text-cyan-200">{route.venue} · {route.router}</span>
    <span className="font-mono">{route.outAmount} raw output units</span>
    <span className="text-white/50">{route.cacheAgeMs}ms cache age · {route.priceSource}</span>
   </div>)}
   {result.routes.length===0?<p className="text-xs text-amber-200">No fresh eligible quotes were returned.</p>:null}
   <p className="text-[11px] text-white/40">Quotes reflect different venue contracts and fees. Ranking by output alone does not prove execution eligibility, all-in cost or expected settlement.</p>
  </div>:null}
 </section>;
}
