import {useMemo,useState} from "react";
import {Link} from "@tanstack/react-router";
import {ArrowRight,Calculator,CloudRain,Landmark,Layers3,ShieldAlert,Wallet,Info,Truck,Zap} from "lucide-react";
import {CONTINGENCY_USE_CASES,contingencyReservePlan,contingencyScenario,type ContingencyQuote} from "@/lib/contingency-analysis.mjs";
import type {EventQuote} from "@/lib/event-contract-router.mjs";
import type {KalshiRow} from "@/lib/kalshi-book";

const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const field="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#101b2c] px-3 font-mono text-sm text-white outline-none focus:border-cyan-300/50";
const cases=[CloudRain,Truck,Zap,Landmark,Layers3] as const;

type Props={
 market:KalshiRow|null;planned:EventQuote|null;
 chosenSide:"yes"|"no";budget:number;clock:number;
 onBudget:(n:number)=>void;onKeyword:(q:string)=>void;
};
export function EventContingencyLab({market,planned,chosenSide,budget,clock,onBudget,onKeyword}:Props){
 const [type,setType]=useState("weather");
 const [possibleLoss,setPossibleLoss]=useState(1500);
 const [cash,setCash]=useState(200);
 const [target,setTarget]=useState(75);
 const quote=useMemo<ContingencyQuote|null>(()=>{
  if(!planned?.available||planned.notExecutable!==true||typeof planned.quotedAt!=="number"||
   typeof planned.contracts!=="number"||typeof planned.grossCostUsd!=="number"||
   typeof planned.maximumPayoutUsd!=="number")return null;
  return {available:true,notExecutable:true,quotedAt:planned.quotedAt,contracts:planned.contracts,
   grossCostUsd:planned.grossCostUsd,maximumPayoutUsd:planned.maximumPayoutUsd,side:chosenSide};
 },[planned,chosenSide]);
 const scenario=useMemo(()=>contingencyScenario({
  quote,possibleLossUsd:possibleLoss,budgetUsd:budget,marketTicker:market?.ticker||"",
  now:clock
 }),[quote,possibleLoss,budget,market?.ticker,clock]);
 const reserve=useMemo(()=>contingencyReservePlan({
  potentialExpenseUsd:possibleLoss,availableCashUsd:cash,targetCoveragePct:target
 }),[possibleLoss,cash,target]);
 const picked=CONTINGENCY_USE_CASES.find(x=>x.id===type)||CONTINGENCY_USE_CASES[0];
 return <section className="overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[#0b1421]">
  <div className="border-b border-white/10 bg-[radial-gradient(ellipse_at_top_right,#253950_0%,#101c2c_46%,#0b1421_90%)] p-5 sm:p-7">
   <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 font-mono text-[10px] font-semibold tracking-[.14em] text-cyan-200">SENDA CONTINGENCY LAB</span><span className="rounded-full border border-amber-300/20 px-3 py-1 font-mono text-[10px] text-amber-200">RESEARCH · NOT INSURANCE</span></div>
   <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Plan for a real-world risk.<br/><span className="text-cyan-200">Never confuse a bet with protection.</span></h2>
   <p className="mt-3 max-w-2xl text-xs leading-6 text-white/55">Explore event-market outcomes alongside possible business or personal expenses. Event resolution, insurance claims and actual cash losses are separate events. No policy is issued, no claim is paid, and no market position is opened here.</p>
   <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
    {CONTINGENCY_USE_CASES.map((x,i)=>{const Icon=cases[i];return <button type="button" key={x.id} onClick={()=>setType(x.id)} aria-pressed={type===x.id}
     className={`rounded-2xl border p-3 text-left transition ${type===x.id?"border-cyan-300/40 bg-cyan-300/10":"border-white/10 bg-white/[.025] hover:border-white/25"}`}>
      <Icon className={`size-5 ${type===x.id?"text-cyan-300":"text-white/40"}`}/><p className="mt-2 text-[12px] font-semibold">{x.name}</p><p className="mt-1 text-[10px] leading-4 text-white/45">{x.detail}</p>
     </button>})}
   </div>
   <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
    <p className="max-w-2xl text-[11px] leading-5 text-amber-100/65"><ShieldAlert className="mr-1 inline size-3 align-middle"/>{picked.caution}.</p>
    <button type="button" onClick={()=>onKeyword(picked.keywords.split(" ")[0])} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-300/25 px-3 text-[11px] text-cyan-200">Find related Kalshi markets <ArrowRight className="size-3"/></button>
   </div>
  </div>
  <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
   <div className="space-y-5 border-b border-white/10 p-5 xl:border-b-0 xl:border-r sm:p-6">
    <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Calculator className="size-4 text-cyan-300"/>Your scenario assumptions</h3>
     <p className="mt-1 text-[11px] text-white/45">Change only your own inputs; Senda never guesses your actual exposure.</p></div>
    <label className="block text-[11px] text-white/60">Possible real-world expense (USD)
     <input type="number" value={possibleLoss} min="0" max="10000000" step="50" onChange={e=>setPossibleLoss(Number(e.target.value))} className={field}/>
    </label>
    <label className="block text-[11px] text-white/60">Event-contract research budget (USD)
     <input type="number" value={budget} min="1" max="100000" step="5" onChange={e=>onBudget(Number(e.target.value))} className={field}/>
    </label>
    <div className="border-t border-white/10 pt-5"><p className="text-sm font-semibold">Self-funded cash buffer</p>
     <p className="mt-1 text-[11px] text-white/45">A separate, non-market way to prepare for an expense.</p>
     <label className="mt-4 block text-[11px] text-white/60">Available reserve cash (USD)
      <input type="number" value={cash} min="0" max="10000000" step="50" onChange={e=>setCash(Number(e.target.value))} className={field}/>
     </label>
     <label className="mt-4 block text-[11px] text-white/60">Target reserve share: {target}%
      <input type="range" min="0" max="100" step="5" value={target} onChange={e=>setTarget(Number(e.target.value))} className="mt-3 w-full accent-cyan-300"/>
     </label>
     {reserve.ready?<div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-white/[.035] p-3"><p className="text-[10px] text-white/45">Target buffer</p><p className="mt-1 font-mono text-lg font-semibold">{money(reserve.targetCashReserveUsd)}</p></div>
      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[.045] p-3"><p className="text-[10px] text-cyan-200/70">Additional cash needed</p><p className="mt-1 font-mono text-lg font-semibold text-cyan-200">{money(reserve.additionalCashRequiredUsd)}</p></div>
     </div>:<p className="mt-3 text-xs text-amber-200">{reserve.reason}</p>}
    </div>
   </div>
   <div className="space-y-5 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><p className="font-mono text-[10px] tracking-widest text-cyan-300">INDEPENDENT OUTCOME MATRIX</p><h3 className="mt-2 text-lg font-semibold">{market?.yes||market?.title||"Select a real Kalshi event"}</h3><p className="mt-1 text-[11px] text-white/40">{market?.ticker||"Pick a market from the source catalog to begin."}</p></div>
     <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] text-white/50">{chosenSide.toUpperCase()} side · {quote?.contracts??0} contracts</span>
    </div>
    {scenario.ready?<>
     <div className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><p className="text-[10px] text-white/45">Public-book gross cost</p><p className="mt-1 font-mono text-xl font-semibold">{money(scenario.grossCostBeforeFees)}</p></div>
      <div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><p className="text-[10px] text-white/45">Event payout if side wins</p><p className="mt-1 font-mono text-xl font-semibold">{money(scenario.maximumEventPayoutBeforeFees)}</p></div>
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/[.045] p-3"><p className="text-[10px] text-amber-200/80">Venue fees / actual fill</p><p className="mt-1 font-mono text-xl font-semibold text-amber-200">Unknown</p></div>
     </div>
     <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[510px] text-left text-xs">
      <thead className="bg-white/[.045] text-[10px] uppercase tracking-widest text-white/45"><tr><th className="px-3 py-3 font-medium">Market resolves</th><th className="px-3 py-3 font-medium">Real-world loss</th><th className="px-3 py-3 font-medium">Contract P/L</th><th className="px-3 py-3 text-right font-medium">Combined net*</th></tr></thead>
      <tbody>{scenario.events.map(x=><tr key={x.id} className="border-t border-white/10"><td className="px-3 py-4 font-semibold">{x.marketResolves.toUpperCase()}</td><td className="px-3 py-4">{x.realWorldLoss?money(scenario.possibleIndependentRealWorldLoss):"No loss"}</td><td className={`px-3 py-4 font-mono ${x.contractNetBeforeFees>=0?"text-emerald-300":"text-rose-300"}`}>{money(x.contractNetBeforeFees)}</td><td className={`px-3 py-4 text-right font-mono font-semibold ${x.overallNetBeforeFees>=0?"text-emerald-300":"text-rose-300"}`}>{money(x.overallNetBeforeFees)}</td></tr>)}</tbody>
     </table></div>
     <p className="text-[11px] leading-5 text-white/40">*Combined net subtracts the assumed expense and includes the contract's gross purchase cost. Excludes venue fees, taxes, market impact, and opportunity cost. Outcomes are not a probability forecast.</p>
    </>:<div className="flex min-h-[255px] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 px-5 text-center"><ShieldAlert className="size-7 text-amber-200/60"/><h4 className="mt-3 text-base font-semibold">No valid contract scenario</h4><p className="mt-2 max-w-lg text-xs leading-6 text-white/50">{scenario.reason} This tool will not substitute simulated bids or claim available liquidity.</p></div>}
    <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.045] p-4">
     <div className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-amber-200"/><p className="text-xs leading-5 text-white/65"><strong className="text-amber-100">Not insurance or guaranteed hedging.</strong> A contract can expire worthless even if an unrelated loss occurs. Senda does not issue policies, collect premiums for claims, hold reserves for policyholders or promise reimbursement.</p></div>
    </div>
    <div className="flex flex-wrap gap-2"><Link to="/pre/cover" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[.055] px-3 text-[11px] text-cyan-200">Explore separate PreStock cover product <ArrowRight className="size-3"/></Link><Link to="/payments" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-[11px] text-white/60"><Wallet className="size-3"/>Cash and payments</Link></div>
   </div>
  </div>
 </section>;
}
