import {useMemo,useState} from "react";
import {Link} from "@tanstack/react-router";
import {ArrowRight,ShieldCheck,Route,Wallet,ArrowUpRight,Info} from "lucide-react";
import {PREDICTION_VENUES,predictionFundingPaths,venueById} from "@/lib/prediction-venues.mjs";

type VenueId="kalshi-public"|"phantom-us"|"dflow"|"world"|"polymarket";
const stateColor:Record<string,string>={
 research:"border-white/15 bg-white/[.04] text-white/60",
 handoff:"border-violet-300/30 bg-violet-300/10 text-violet-200",
 "approval-gated":"border-amber-300/30 bg-amber-300/10 text-amber-100"
};
export function PredictionVenueRouter({selected,onChange}:{selected:VenueId;onChange:(id:VenueId)=>void}){
 const venue=useMemo(()=>venueById(selected),[selected]);
 const funding=predictionFundingPaths();
 const availableVenue=PREDICTION_VENUES.find(v=>v.id==="dflow");
 return <section className="space-y-4 rounded-[24px] border border-cyan-300/15 bg-[#0a1422] p-4 sm:p-6">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="font-mono text-[10px] tracking-[.22em] text-cyan-300">SENDA PREDICTIONS / MULTI-VENUE ROUTER</p>
    <h2 className="mt-2 text-xl font-semibold sm:text-2xl">One desk. Distinct execution networks.</h2>
    <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/55">Your Phantom Cash, a Kalshi brokerage account, and a Solana outcome token do not share the same balances or settlement. Discover each venue here and select its actual authorized execution pathway.</p>
   </div><Route className="size-6 text-cyan-300"/>
  </div>
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="Prediction execution venue">
   {PREDICTION_VENUES.map(v=><button type="button" key={v.id} onClick={()=>onChange(v.id as VenueId)}
    aria-pressed={selected===v.id}
    className={`min-h-[116px] rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selected===v.id?"border-cyan-300/60 bg-cyan-300/[.09]":"border-white/10 bg-white/[.02] hover:border-white/25"}`}>
    <p className="text-sm font-semibold">{v.name}</p>
    <span className={`mt-2 inline-block rounded-md border px-2 py-1 font-mono text-[10px] ${stateColor[v.status]||stateColor.research}`}>{v.status}</span>
    <p className="mt-2 text-[10px] text-white/45">{v.region}</p>
   </button>)}
  </div>
  {venue?<div className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_1fr]">
   <div><p className="text-sm font-semibold">{venue.name}</p>
    <p className="mt-1 text-xs leading-relaxed text-white/60">{venue.description}</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
     <div><p className="text-[10px] text-white/35">Funding</p><p className="mt-1 text-xs">{venue.funding}</p></div>
     <div><p className="text-[10px] text-white/35">Settlement</p><p className="mt-1 text-xs">{venue.settlement}</p></div>
    </div>
   </div>
   <div className="flex flex-col justify-between gap-3">
    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-100/75"><Info className="mt-0.5 size-4 shrink-0"/>Venue selection never converts a public quote into an executable order or transfers funds automatically. Confirm fees, account identity and current market rules at each venue.</p>
    {selected==="phantom-us"||selected==="world"?
     <div className="rounded-xl border border-violet-300/15 bg-violet-300/5 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold"><Wallet className="size-4"/>Use Phantom's native prediction experience</p>
      <p className="mt-1 text-xs text-white/55">Phantom's mobile Predict section handles its own market discovery, wallet approval and account settlement. Senda cannot assume its session.</p>
      <a className="mt-3 inline-flex items-center gap-2 text-xs text-violet-200" href="https://phantom.com/" target="_blank" rel="noopener noreferrer">Phantom official site <ArrowUpRight className="size-3"/></a>
     </div>:
    selected==="dflow"?<div className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="size-4"/>On-chain Phantom-signed route</p>
      <p className="mt-1 text-xs text-white/55">Eligible for in-app execution only when DFlow metadata, approved market, KYC, jurisdiction, partner API and transaction program checks all pass. The signer appears on supported event detail screens.</p>
     </div>:
     <p className="rounded-xl border border-white/10 bg-white/[.035] p-3 text-xs text-white/55">Research feed only. No account/position import or executable quote is connected for this venue.</p>}
   </div>
  </div>:null}
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{funding.map(x=>
   <div key={x.source} className="rounded-xl border border-white/10 bg-white/[.025] p-3">
    <p className="text-xs font-semibold">{x.source} <span className="text-white/35">→</span> {x.target}</p>
    <p className="mt-2 font-mono text-[10px] text-cyan-200">{x.available}</p><p className="mt-2 text-[11px] leading-relaxed text-white/45">{x.note}</p>
   </div>
  )}</div>
  <div className="flex flex-wrap gap-2">
   <Link to="/liquify" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs">Liquify routing<ArrowRight className="size-3"/></Link>
   <Link to="/payments" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs">Pay & Send<ArrowRight className="size-3"/></Link>
  </div>
 </section>;
}
