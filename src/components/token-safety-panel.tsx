import {useState} from "react";
import {inspectSolanaToken} from "@/lib/token-safety";
const SOL="So11111111111111111111111111111111111111112";
type Inspection=Awaited<ReturnType<typeof inspectSolanaToken>>;
export function TokenSafetyPanel(){
 const [mint,setMint]=useState(SOL);
 const [result,setResult]=useState<Inspection|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const inspect=async()=>{
  setResult(null);setError("");setBusy(true);
  try{setResult(await inspectSolanaToken({data:{mint}}));}
  catch(e){setError(e instanceof Error?e.message:"Mint inspection unavailable");}
  finally{setBusy(false);}
 };
 return <section className="mb-4 space-y-3 rounded-[22px] border border-violet-300/20 bg-[#0c1523] p-5 text-white">
  <div className="flex flex-wrap justify-between gap-2"><div><p className="text-[10px] font-mono uppercase tracking-widest text-violet-300">Senda / Asset Inspector</p>
   <h2 className="mt-1 text-xl font-semibold">Know the token program before you sign</h2>
   <p className="mt-1 max-w-2xl text-xs text-white/55">Verified RPC mint state, Token-2022 extensions and Jupiter Token API signals. A clean result does not prove that a token cannot be rugged.</p></div>
   <span className="self-start rounded-lg border border-white/15 px-2 py-1 text-[10px] text-white/50">Read-only</span>
  </div>
  <div className="flex flex-col gap-2 sm:flex-row">
   <input aria-label="Token mint to inspect" value={mint} onChange={e=>setMint(e.target.value.trim())} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-xs" />
   <button type="button" onClick={inspect} disabled={busy} className="rounded-xl bg-violet-300 px-4 py-2 text-xs font-bold text-[#101024] disabled:opacity-40">{busy?"Inspecting…":"Inspect on-chain mint"}</button>
  </div>
  {error?<p role="alert" className="text-xs text-amber-200">{error}</p>:null}
  {result?<div aria-live="polite" className="space-y-2 rounded-xl border border-white/10 p-3">
   <div className="flex flex-wrap gap-2 text-xs"><span>RPC: {result.status}</span><span>Jupiter verified: {result.jupiterVerified===null?"unknown":result.jupiterVerified?"yes":"no"}</span>
    <span>Organic score: {result.organicScore??"unknown"}</span></div>
   <p className="break-all font-mono text-xs text-white/70">{result.tokenProgram??"Mint program not verified"}</p>
   <p className="text-xs text-white/55">Decimals: {result.decimals??"unknown"} · Mint authority: {result.mintAuthorityPresent===null?"unknown":result.mintAuthorityPresent?"present":"none"} · Freeze authority: {result.freezeAuthorityPresent===null?"unknown":result.freezeAuthorityPresent?"present":"none"}</p>
   <p className="text-xs text-amber-200">{result.riskFlags.length?result.riskFlags.join(" · "):"No configured flags detected; additional checks are still required."}</p>
   <p className="text-[11px] text-white/45">{result.warning}</p>
  </div>:null}
 </section>;
}
