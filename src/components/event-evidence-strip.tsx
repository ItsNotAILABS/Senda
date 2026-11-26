import {useEffect,useMemo,useState} from "react";
import {Activity,ShieldAlert,ShieldCheck} from "lucide-react";
import {getKalshiHistory,type KalshiHistoryResult} from "@/lib/kalshi-history";
import type {KalshiContractDetail} from "@/lib/kalshi-market-detail";
import type {EventBook} from "@/lib/event-contract-router.mjs";
import {analyzeEventEvidence} from "@/lib/event-risk-intelligence.mjs";

/** Low-profile research quality strip. Uses the same Kalshi source readers as the existing desk. */
export function EventEvidenceStrip({ticker,seriesTicker,book,contract,now,refreshKey=0}:{
 ticker:string;seriesTicker?:string;book:EventBook|null;contract:KalshiContractDetail|null;now:number;refreshKey?:number;
}){
 const [history,setHistory]=useState<KalshiHistoryResult|null>(null);
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
  if(!ticker||!seriesTicker){setHistory(null);return;}
  let active=true;setLoading(true);setHistory(null);
  void getKalshiHistory({data:{ticker,seriesTicker,window:"24h"}})
   .then(h=>{if(active)setHistory(h)})
   .catch(()=>{if(active)setHistory(null)})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[ticker,seriesTicker,refreshKey]);
 const risk=useMemo(()=>{
  if(!book||!contract||!history||book.ticker!==ticker||contract.ticker!==ticker||history.ticker!==ticker)return null;
  try{return analyzeEventEvidence({detail:contract,book,history,now})}
  catch{return null}
 },[book,contract,history,ticker,now]);
 const status=risk?.quality??"unavailable";
 const labels:Record<string,string>={
  MARKET_NOT_ACTIVE:"Market not open",MARKET_CLOSE_PASSED:"Market close passed",
  BOOK_NOT_FRESH:"Depth is stale",INCOMPLETE_TWO_SIDED_BOOK:"Incomplete depth",
  CROSSED_OR_INCONSISTENT_BOOK:"Inconsistent order book",
  RULES_UNAVAILABLE:"Rules unavailable",RECENT_PRICE_MISSING:"Recent candles unavailable",
  HISTORY_UNAVAILABLE:"History unavailable",UNVERIFIED_CLOSE_TIME:"Close time unverified"
 };
 return <section className="rounded-2xl border border-white/10 bg-[#0b1827] p-4" aria-label="Event evidence quality">
  <div className="flex items-start justify-between gap-3">
   <div><p className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-cyan-300">
    <Activity className="size-3.5"/> SOURCE & EVENT EVIDENCE</p>
    <p className="mt-1 text-[11px] text-white/45">Kalshi contract rules, public opposing bids and reported candle history</p>
   </div>
   <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/70">
    {risk?.researchReady?<ShieldCheck className="size-3 text-emerald-300"/>:<ShieldAlert className="size-3 text-amber-300"/>}
    {loading?"Checking sources":status==="complete"?"Sourced":status==="limited"?"Partial evidence":status==="blocked"?"Blocked evidence":"Unavailable"}
   </span>
  </div>
  {risk?<div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
   <div><p className="text-white/40">YES bid / implied ask</p><p className="mt-1 font-mono">{risk.market.yesBestBidUsd==null?"—":Math.round(risk.market.yesBestBidUsd*100)+"¢"} / {risk.market.yesImpliedAskUsd==null?"—":Math.round(risk.market.yesImpliedAskUsd*100)+"¢"}</p></div>
   <div><p className="text-white/40">Displayed spread</p><p className="mt-1 font-mono">{risk.market.spreadUsd==null?"—":(risk.market.spreadUsd*100).toFixed(2)+"¢"}</p></div>
   <div><p className="text-white/40">Visible bid depth</p><p className="mt-1 font-mono">{risk.market.yesBidDepthContracts} YES · {risk.market.noBidDepthContracts} NO</p></div>
   <div><p className="text-white/40">Source age</p><p className="mt-1 font-mono">{risk.evidence.bookAgeMs==null?"Unknown":Math.max(0,Math.round(risk.evidence.bookAgeMs/1000))+" sec"}</p></div>
  </div>:<p className="mt-3 text-xs text-amber-100/75">Awaiting matching source contract, depth and price history. No quality assertion is available.</p>}
  {risk?.flags.length?<div className="mt-3 flex flex-wrap gap-1.5">{risk.flags.map(flag=><span key={flag} className="rounded-md border border-amber-300/15 bg-amber-300/[.05] px-2 py-1 text-[10px] text-amber-100/80">{labels[flag]??flag}</span>)}</div>:null}
  <p className="mt-3 text-[10px] leading-5 text-white/35">Research evidence only · No insurance, probability prediction, execution quote or wallet trading authorization. Refresh the market for new depth.</p>
 </section>;
}
