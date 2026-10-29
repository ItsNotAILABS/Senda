import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity, ArrowDownToLine, ArrowLeftRight, ArrowRight, Bot, CheckCircle2,
  Database, ExternalLink, FileSearch, LoaderCircle, LockKeyhole, Radar,
  ShieldCheck, Sparkles, AlertTriangle, Network
} from "lucide-react";
import { toast } from "sonner";
import { explainUtilityResearch, getUtilityResearch, getUtilityInstruments, type UtilityEvidence, type UtilityExplanation, type UtilityQuery, type UtilityInstrumentList } from "@/lib/utility-ai";
import type { UtilityTask, UtilityFact } from "@/lib/utility-ai-core.mjs";

const TASKS=[
 {id:"market",label:"Market Analyst",desc:"PreStocks vs provider mark",icon:Radar},
 {id:"liquidity",label:"Liquidity Analyst",desc:"Solana pool and activity evidence",icon:Activity},
 {id:"transfer",label:"Transfer Analyst",desc:"Stablecoin routing requirements",icon:ArrowLeftRight}
] as const;
const field="min-h-11 w-full rounded-xl border border-white/15 bg-[#0b1624] px-4 font-mono text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60";
function formatFact(fact:UtilityFact){
 if(typeof fact.value!=="number")return fact.value;
 if(fact.unit==="%"||fact.unit==="swaps"||fact.unit==="addresses")return fact.value.toLocaleString("en-US",{maximumFractionDigits:2})+(fact.unit==="%"?"%":"");
 if(fact.unit==="USD"||fact.unit==="USD/token")return "$"+fact.value.toLocaleString("en-US",{maximumFractionDigits:fact.value<1?6:2});
 return fact.value.toLocaleString("en-US",{maximumFractionDigits:4})+(fact.unit?" "+fact.unit:"");
}
function readable(t:string){const d=new Date(t);return Number.isNaN(d.getTime())?"Unknown time":d.toLocaleString();}
export function UtilityAIDesk(){
 const [task,setTask]=useState<UtilityTask>("market");
 const [mint,setMint]=useState("");
 const [currency,setCurrency]=useState<"USDC"|"USDT">("USDC");
 const [amount,setAmount]=useState("25");
 const [registry,setRegistry]=useState<UtilityInstrumentList|null>(null);
 const [evidence,setEvidence]=useState<UtilityEvidence|null>(null);
 const [explanation,setExplanation]=useState<UtilityExplanation|null>(null);
 const [pending,setPending]=useState(false);
 const [modelPending,setModelPending]=useState(false);
 const [problem,setProblem]=useState("");
 useEffect(()=>{let live=true;void getUtilityInstruments().then(result=>{if(live)setRegistry(result);}).catch(()=>{if(live)setRegistry({state:"unavailable",observedAt:null,source:"PreStocks public API",instruments:[]});});return()=>{live=false;};},[]);
 const validMint=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint.trim());
 const canResearch=task==="transfer"?amount.trim()===""||(Number.isFinite(Number(amount))&&Number(amount)>0&&Number(amount)<=100000):validMint;
 const params=():UtilityQuery=>task==="transfer"?{
  task,currency,amount:amount.trim()?Number(amount):null
 }:{task,mint:mint.trim()};
 function switchTask(next:UtilityTask){setTask(next);setEvidence(null);setExplanation(null);setProblem("");}
 async function research(){
  if(!canResearch)return;
  setPending(true);setProblem("");setEvidence(null);setExplanation(null);
  try{const result=await getUtilityResearch({data:params()});setEvidence(result);}
  catch(e){setProblem(e instanceof Error?e.message:"Research service unavailable.");}
  finally{setPending(false);}
 }
 async function generate(){
  if(!evidence||modelPending)return;
  setModelPending(true);setProblem("");
  try{const result=await explainUtilityResearch({data:params()});
   setExplanation(result);setEvidence(result.evidence);
   if(result.modelStatus!=="ready")toast.message(result.note);
  }catch(e){setProblem(e instanceof Error?e.message:"Model service unavailable. Sign in and retry.");}
  finally{setModelPending(false);}
 }
 function exportReceipt(){
  if(!evidence)return;
  const data={schema:"senda.utility-ai.receipt.v1",exportedAt:new Date().toISOString(),
   evidence,modelStatus:explanation?.modelStatus??"not-requested",model:explanation?.model??null};
  const uri=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=uri;link.download="senda-utility-research-"+new Date().toISOString().slice(0,10)+".json";link.click();
  window.setTimeout(()=>URL.revokeObjectURL(uri),1000);
  toast.success("Evidence receipt exported locally.");
 }
 const counts=useMemo(()=>({
  facts:evidence?.report.facts.length??0,risks:evidence?.report.risks.length??0,
  sources:Object.values(evidence?.sourceState??{}).filter(x=>x==="ready").length
 }),[evidence]);
 const oldEvidence=explanation&&evidence?.report.observedAt!==explanation.evidence.report.observedAt;
 return <div className="min-h-[80vh] bg-[#070b13] px-3 pb-12 pt-4 text-white sm:px-6 lg:px-8">
  <section className="relative overflow-hidden rounded-[26px] border border-cyan-300/15 bg-[radial-gradient(ellipse_at_85%_-20%,#214967_0%,#101d2d_37%,#080d17_75%)] p-5 sm:p-7">
   <div className="absolute right-5 top-4 select-none font-mono text-[9px] tracking-[.28em] text-cyan-100/20">SENDA · INTELLIGENCE RUNTIME</div>
   <div className="max-w-2xl"><div className="flex items-center gap-2 font-mono text-[10px] tracking-[.25em] text-cyan-300"><span className="grid size-7 place-items-center rounded-lg border border-cyan-300/35 bg-cyan-300/10"><Bot className="size-4"/></span>AI UTILITY / READ ONLY</div>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Make every decision evidence-first.</h1>
    <p className="mt-3 text-sm leading-6 text-white/60">Three working financial utilities on one desk. Public-source market and liquidity research is available without a model key. Structured AI interpretation uses a verified session and server-only credentials when enabled.</p>
   </div>
   <div className="mt-5 grid gap-2 sm:grid-cols-3">
    {TASKS.map(({id,label,desc,icon:Icon})=><button type="button" key={id} onClick={()=>switchTask(id)} aria-pressed={task===id}
      className={`rounded-2xl border p-4 text-left transition ${task===id?"border-cyan-300/40 bg-cyan-300/[0.12]":"border-white/10 bg-black/20 hover:border-white/25"}`}>
      <Icon className={`size-5 ${task===id?"text-cyan-300":"text-white/45"}`}/>
      <p className="mt-3 text-sm font-semibold">{label}</p><p className="mt-1 text-[11px] text-white/50">{desc}</p>
    </button>)}
   </div>
  </section>

  <div className="mt-4 grid gap-4 xl:grid-cols-[350px_minmax(0,1fr)]">
   <aside className="space-y-4">
    <section className="rounded-2xl border border-white/10 bg-[#0c1320] p-5">
     <div className="flex items-center gap-2"><FileSearch className="size-4 text-cyan-300"/><h2 className="text-sm font-semibold">Research setup</h2></div>
     {task!=="transfer"?<>
      {registry?.state==="ready"?<div className="mt-4">
       <label className="block text-xs text-white/60" htmlFor="senda-ai-registry">Choose a currently listed PreStock</label>
       <select id="senda-ai-registry" className={field+" mt-2"} value={registry.instruments.some(x=>x.mint===mint) ? mint : ""} onChange={e=>{setMint(e.target.value);setEvidence(null);setExplanation(null);}}>
        <option value="">Select a live provider listing</option>
        {registry.instruments.map(x=><option key={x.mint} value={x.mint}>{x.symbol} — {x.name}</option>)}
       </select>
       <p className="mt-1 font-mono text-[10px] text-emerald-200/75">PreStocks API · {registry.instruments.length} sourced instruments · {registry.observedAt?readable(registry.observedAt):"Unverified timestamp"}</p>
      </div>:<p className="mt-4 text-[11px] text-amber-200/65">PreStocks instrument lookup unavailable. You can still enter an exact mint manually.</p>}
      <label className="mt-4 block text-xs text-white/60" htmlFor="senda-ai-mint">Solana token mint</label>
      <input id="senda-ai-mint" value={mint} onChange={e=>{setMint(e.target.value.trim());setEvidence(null);setExplanation(null);}} className={field+" mt-2"} placeholder="Paste a real Solana mint" spellCheck={false} autoComplete="off" maxLength={48}/>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
       <span className={validMint?"text-emerald-300":"text-white/40"}>{validMint?"Mint format valid · identity not yet verified":"Exact mint required · never guessed"}</span>
       <Link to="/pre" className="flex items-center gap-1 text-cyan-300">Browse PreStocks <ArrowRight className="size-3"/></Link>
      </div>
     </>:<>
      <label htmlFor="senda-ai-currency" className="mt-4 block text-xs text-white/60">Network / stablecoin</label>
      <select id="senda-ai-currency" className={field+" mt-2"} value={currency} onChange={e=>{setCurrency(e.target.value as "USDC"|"USDT");setEvidence(null);setExplanation(null);}}>
       <option value="USDC">Solana · USDC</option><option value="USDT">Solana · USDT</option>
      </select>
      <label htmlFor="senda-ai-amount" className="mt-4 block text-xs text-white/60">Proposed amount (optional)</label>
      <input id="senda-ai-amount" className={field+" mt-2"} value={amount} onChange={e=>{setAmount(e.target.value);setEvidence(null);setExplanation(null);}} inputMode="decimal" placeholder="25.00"/>
      <p className="mt-2 text-[11px] text-white/40">This only creates a checklist. It cannot send any tokens or verify an actual balance.</p>
     </>}
     <button type="button" onClick={()=>void research()} disabled={!canResearch||pending||modelPending}
      className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 font-semibold text-[#06121d] disabled:opacity-40">
      {pending?<LoaderCircle className="size-4 animate-spin"/>:<Radar className="size-4"/>}{pending?"Checking live sources...":"Run verified research"}
     </button>
     <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="font-mono text-[10px] text-cyan-300">DATA RULES</p>
      <p className="mt-2 text-[11px] leading-5 text-white/50">No prefilled holdings, trading volumes or executions. Missing provider data is unavailable, never zero. This AI has no wallet signature or transaction tools.</p>
     </div>
    </section>
    <section className="rounded-2xl border border-white/10 bg-[#0c1320] p-4">
     <p className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="size-4 text-emerald-300"/>Authority boundary</p>
     <div className="mt-3 space-y-2 font-mono text-[11px] text-white/55">
      <p>CAN · Read validated public market facts</p>
      <p>CAN · Explain risks and review steps</p>
      <p>CANNOT · Sign, swap, transfer, mint or custody</p>
      <p>CANNOT · Manufacture prices or liquidity</p>
     </div>
    </section>
   </aside>

   <div className="min-w-0 space-y-4">
    {problem?<div role="alert" className="rounded-xl border border-rose-300/30 bg-rose-500/[0.08] p-4 text-sm text-rose-100">{problem}</div>:null}
    {!evidence?<section className="flex min-h-[410px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0a111e] px-7 text-center">
     <div className="grid size-16 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06]"><Network className="size-8 text-cyan-300"/></div>
     <h2 className="mt-5 text-xl font-semibold">Your evidence workspace is ready</h2>
     <p className="mt-2 max-w-md text-sm leading-6 text-white/50">Select a utility, enter a real mint or transfer amount, and run the source checks. Reports appear here with timestamps, provenance, risk flags, and a transparent audit receipt.</p>
    </section>:<>
     <section aria-live="polite" className="rounded-2xl border border-white/10 bg-[#0c1421] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div><p className="font-mono text-[10px] uppercase tracking-[.22em] text-cyan-300">RESEARCH RECEIPT · {evidence.report.dataStatus}</p>
        <h2 className="mt-2 text-xl font-semibold">{evidence.report.headline}</h2>
        <p className="mt-1 font-mono text-[11px] text-white/45">Observed {readable(evidence.report.observedAt)} · {evidence.report.scope}</p>
       </div>
       <button type="button" onClick={exportReceipt} className="flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs text-white/70 hover:border-cyan-300/40"><ArrowDownToLine className="size-4"/>Export receipt</button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
       {[["Verified facts",counts.facts],["Reported risks",counts.risks],["Responding sources",counts.sources]].map(([label,value])=>
        <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] text-white/40">{label}</p><p className="mt-1 font-mono text-2xl font-semibold">{value}</p></div>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
       {Object.entries(evidence.sourceState).map(([name,status])=><span key={name} className={`rounded-full border px-2.5 py-1 ${status==="ready"?"border-emerald-300/25 text-emerald-200":status==="unavailable"?"border-amber-300/20 text-amber-200":"border-white/10 text-white/40"}`}>{name} · {status}</span>)}
      </div>
      {evidence.errors.length?<div className="mt-3 space-y-1 text-[11px] text-amber-200">{evidence.errors.map((error,i)=><p key={i}>• {error}</p>)}</div>:null}
     </section>
     <section className="rounded-2xl border border-white/10 bg-[#0c1421] p-4 sm:p-5">
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-cyan-300"/>Verified observations</h2><span className="font-mono text-[10px] text-white/40">SOURCE-LINKED</span></div>
      {evidence.report.facts.length?<div className="mt-4 grid gap-2 sm:grid-cols-2">
       {evidence.report.facts.map(f=><div key={f.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
        <p className="text-[11px] text-white/45">{f.label}</p><p className="mt-1 break-words font-mono text-base font-semibold">{formatFact(f)}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-white/40"><span className="truncate">{f.source}</span><a href={f.url} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-cyan-300">Source <ExternalLink className="size-3"/></a></div>
       </div>)}
      </div>:<p className="mt-4 rounded-xl bg-amber-300/[0.05] p-4 text-sm text-amber-200">No verified numerical observations. The desk will not generate replacement market metrics.</p>}
     </section>
     <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-amber-300/15 bg-[#151723] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200"><AlertTriangle className="size-4"/>Risks & missing proof</h3>
       <ul className="mt-3 space-y-3 text-xs leading-5 text-white/70">{evidence.report.risks.map((x,i)=><li key={i}>• {x}</li>)}</ul>
      </section>
      <section className="rounded-2xl border border-emerald-300/15 bg-[#101a20] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><CheckCircle2 className="size-4"/>Next verified actions</h3>
       <ol className="mt-3 space-y-3 text-xs leading-5 text-white/70">{evidence.report.actions.map((x,i)=><li key={i}>{i+1}. {x}</li>)}</ol>
      </section>
     </div>
     <section className="rounded-2xl border border-cyan-300/15 bg-[#101b2b] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div><p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-cyan-300"><Sparkles className="size-4"/>MODEL INTERPRETATION</p><h3 className="mt-2 text-lg font-semibold">Evidence-linked analysis</h3>
        <p className="mt-1 max-w-xl text-xs leading-5 text-white/55">Optional structured model pass. Requires a signed-in Senda account and enabled server configuration. Model output is checked against fact IDs before display.</p>
       </div>
       <button type="button" disabled={modelPending||pending||!evidence.report.facts.length} onClick={()=>void generate()} className="flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-300/[0.12] px-4 text-xs font-semibold text-cyan-200 disabled:opacity-40">
        {modelPending?<LoaderCircle className="size-4 animate-spin"/>:<Sparkles className="size-4"/>}{modelPending?"Analyzing...":"Generate analysis"}
       </button>
      </div>
      {explanation?<div className="mt-4 border-t border-white/10 pt-4">
       <p className="font-mono text-[10px] uppercase text-cyan-300">{explanation.modelStatus} · {explanation.modelName??"model not configured"}</p>
       <p className="mt-2 text-xs text-white/50">{explanation.note}</p>
       {explanation.model?<>
        <p className="mt-4 text-sm leading-6 text-white">{explanation.model.summary}</p>
        <div className="mt-3 space-y-2">{explanation.model.observations.map((o,i)=><div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs leading-5 text-white/80">{o.text}</p><p className="mt-2 font-mono text-[10px] text-cyan-300">Evidence: {o.evidence_ids.join(" · ")}</p></div>)}</div>
        {explanation.model.uncertainties.length?<p className="mt-3 text-xs text-amber-200">Uncertainties: {explanation.model.uncertainties.join(" · ")}</p>:null}
        <p className="mt-3 text-[11px] text-white/45">Further review: {explanation.model.next_steps.join(" · ")}</p>
       </>:null}
      </div>:<p className="mt-4 text-[11px] text-white/40">No model analysis requested. Verified evidence above is the authoritative research output.</p>}
      {oldEvidence?<p className="mt-2 text-[11px] text-amber-200">Model interpretation references an earlier evidence snapshot; re-run before acting.</p>:null}
     </section>
     <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1522] px-4 py-3 text-[11px] text-white/45">
      <span className="flex items-center gap-2"><LockKeyhole className="size-4 text-emerald-300"/>Research only · wallet signing remains separate</span>
      <div className="flex items-center gap-3"><Link to="/invest" className="flex items-center gap-1 text-cyan-300">Trading desk <ArrowRight className="size-3"/></Link><Link to="/payments" className="flex items-center gap-1 text-cyan-300">Transfers <ArrowRight className="size-3"/></Link></div>
     </div>
    </>}
   </div>
  </div>
 </div>;
}
