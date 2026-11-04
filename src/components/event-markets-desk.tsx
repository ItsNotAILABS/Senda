import {useEffect,useMemo,useState} from "react";
import {ArrowUpRight,CloudRain,Search,RefreshCw,ShieldAlert,BarChart3,ArrowRight} from "lucide-react";
import {Link} from "@tanstack/react-router";
import {PhantomPredictBridge} from "@/components/phantom-predict-bridge";
import {kalshiPage,type KalshiRow} from "@/lib/kalshi-book";
import {getKalshiDepth} from "@/lib/kalshi-depth";
import {EVENT_TEMPLATES,planEventSide,evaluateEventProduct,eventMarketUrl,type EventBook} from "@/lib/event-contract-router.mjs";

const fmt=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const price=(p:number|null)=>p==null?"—":Math.round(p*100)+"¢";
const box="rounded-[22px] border border-white/10 bg-[#0c1524] p-4 sm:p-5";
export function EventMarketsDesk(){
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("");
 const [template,setTemplate]=useState("weather");
 const [rows,setRows]=useState<KalshiRow[]>([]);
 const [categories,setCategories]=useState<Array<{id:string;n:number}>>([]);
 const [market,setMarket]=useState<KalshiRow|null>(null);
 const [book,setBook]=useState<EventBook|null>(null);
 const [side,setSide]=useState<"yes"|"no">("yes");
 const [contracts,setContracts]=useState(5);
 const [budget,setBudget]=useState(25);
 const [loading,setLoading]=useState(false);
 const [depthLoading,setDepthLoading]=useState(false);
 const [stamp,setStamp]=useState(0);
 const [clock,setClock]=useState(Date.now());
 useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),10000);return()=>window.clearInterval(timer)},[]);
 const [note,setNote]=useState("Loading public Kalshi markets…");
 const [depthNote,setDepthNote]=useState("");
 const [more,setMore]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);
  void kalshiPage({data:{q:query,category,offset:more,limit:40}})
   .then(result=>{if(!active)return;setRows(previous=>more?[...previous,...result.rows]:result.rows);setCategories(result.categories);setNote(result.total+" matching markets · "+result.loaded+" indexed by Senda");})
   .catch(()=>{if(active){setRows([]);setNote("The Kalshi market feed is unavailable.");}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[query,category,more,stamp]);
 useEffect(()=>{
  if(!market){setBook(null);return;}
  let active=true;setDepthLoading(true);setBook(null);setDepthNote("Reading public opposing bids…");
  void getKalshiDepth({data:{ticker:market.ticker}})
    .then(result=>{if(active){setBook(result.book);setDepthNote(result.reason);}})
    .catch(()=>{if(active)setDepthNote("The venue depth could not be verified.");})
    .finally(()=>{if(active)setDepthLoading(false);});
  return()=>{active=false};
 },[market?.ticker,stamp]);
 const planned=useMemo(()=>book?planEventSide(book,side,contracts,clock):null,[book,side,contracts,clock]);
 const product=useMemo(()=>book?evaluateEventProduct({templateId:template,book,side,contracts,budgetUsd:budget,marketTitle:[market?.title,market?.yes].filter(Boolean).join(" "),marketCategory:market?.category||"",now:clock}):null,[template,book,side,contracts,budget,market?.ticker,clock]);
 const selected=EVENT_TEMPLATES.find(x=>x.id===template)!;
 return <div className="mx-auto max-w-[1510px] space-y-4 p-4 text-white sm:p-6">
 <header className="rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,#164956,#0b1728_45%,#090d17)] p-5 sm:p-8">
  <p className="font-mono text-[11px] tracking-[.18em] text-cyan-300">SENDA / LIQUIFY EVENT INTELLIGENCE</p>
  <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Real events. Useful decisions.</h1>
  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/60">Explore public Kalshi event markets, inspect actual order-book depth and model scenario costs. A Phantom account may offer Kalshi trading, but Senda cannot use that connection to place orders without separately authorized integration.</p>
  <div className="mt-4 flex flex-wrap gap-2"><Link to="/liquify" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-[#091622]">Liquify Global <ArrowRight className="size-4"/></Link><Link to="/payments" className="inline-flex min-h-10 items-center rounded-xl border border-white/20 px-4 text-xs">Pay & Send</Link></div>
 </header>
 <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
  <section className={box}>
   <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">VENUE DISCOVERY</p><h2 className="mt-1 text-xl font-semibold">Kalshi public market book</h2></div><button type="button" onClick={()=>setStamp(x=>x+1)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs"><RefreshCw className="size-4"/>Refresh</button></div>
   <label className="relative mt-4 block"><Search className="absolute left-3 top-3 size-4 text-white/40"/><input value={query} onChange={e=>{setQuery(e.target.value);setMore(0)}} className="min-h-10 w-full rounded-xl border border-white/15 bg-[#15243a] pl-10 pr-3 text-sm outline-none" placeholder="Weather, technology, sports, rates, events…"/></label>
   <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{[{id:"",n:0},...categories.slice(0,15)].map(c=><button key={c.id} type="button" onClick={()=>{setCategory(c.id);setMore(0)}} className={`min-h-9 shrink-0 rounded-full px-3 text-xs ${category===c.id?"bg-cyan-300 text-[#061420]":"bg-white/10 text-white/60"}`}>{c.id||"All"}{c.id?" · "+c.n:""}</button>)}</div>
   <p className="mt-1 text-[11px] text-white/45">{loading?"Loading…":note}</p>
   <div className="mt-3 max-h-[580px] overflow-y-auto rounded-xl border border-white/10">{rows.map(r=><button key={r.ticker} type="button" onClick={()=>setMarket(r)} className={`flex min-h-[80px] w-full items-center justify-between gap-3 border-b border-white/10 px-3 text-left hover:bg-white/5 ${market?.ticker===r.ticker?"bg-cyan-300/10":""}`}><span className="min-w-0"><span className="block text-sm font-semibold">{r.yes||r.title}</span><span className="mt-1 block truncate text-[11px] text-white/45">{r.category} · {r.title} · volume {r.vol.toLocaleString()}</span></span><span className="shrink-0 text-right font-mono text-xs"><span className="block text-cyan-300">YES {price(r.bid)} bid</span><span className="block text-white/45">{price(r.ask)} ask</span></span></button>)}{rows.length===0&&!loading?<div className="p-8 text-center text-xs text-white/45">No sourced market data matched. Try another keyword or refresh.</div>:null}</div>
   {rows.length>=40?<button type="button" onClick={()=>setMore(m=>m+40)} className="mt-3 min-h-10 w-full rounded-xl border border-white/15 text-xs">Load more sourced markets</button>:null}
  </section>
  <div className="space-y-4">
   <section className={box}>
    <p className="font-mono text-[10px] tracking-widest text-cyan-300">REAL ORDERBOOK / NO AUTOMATIC TRADE</p>
    <h2 className="mt-2 text-xl font-semibold">{market?.yes||market?.title||"Select an event"}</h2>
    <p className="mt-2 text-xs text-white/50">{market?market.ticker:"Select any market to view its actual opposing-side depth."}</p>
    {market?<><p className="mt-3 text-xs text-white/50">{depthLoading?"Fetching depth…":depthNote}</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setSide("yes")} className={`min-h-10 rounded-xl border text-xs ${side==="yes"?"border-emerald-300/30 bg-emerald-300/10":"border-white/10"}`}>Buy YES research</button><button type="button" onClick={()=>setSide("no")} className={`min-h-10 rounded-xl border text-xs ${side==="no"?"border-rose-300/30 bg-rose-300/10":"border-white/10"}`}>Buy NO research</button></div><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs text-white/50">Contracts<input type="number" min="1" max="1000" step="1" value={contracts} onChange={e=>setContracts(Number(e.target.value))} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-[#172337] px-3"/></label><label className="text-xs text-white/50">Research budget USD<input type="number" min="1" max="100000" step="1" value={budget} onChange={e=>setBudget(Number(e.target.value))} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-[#172337] px-3"/></label></div>{planned?.available?<div className="mt-3 grid grid-cols-2 gap-2">{[["Gross cost",fmt(planned.grossCostUsd!)],["Average",fmt(planned.avgPriceUsd!)],["Max payout",fmt(planned.maximumPayoutUsd!)],["Max loss, before fees",fmt(planned.maximumLossBeforeFeesUsd!)]].map(([k,v])=><div key={k} className="rounded-xl bg-white/[.04] p-3"><p className="text-[10px] text-white/40">{k}</p><p className="mt-1 font-mono text-base">{v}</p></div>)}</div>:<p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">{planned?.reason||"No fresh sourced depth yet."}</p>}<div className="mt-3 flex items-start gap-2 text-[11px] text-white/40"><BarChart3 className="mt-0.5 size-4 shrink-0"/>Estimates cross visible opposing bids, not a guaranteed fill. Fees and slippage beyond visible depth are excluded. Results expire after 30 seconds.</div>{planned?.available&&planned.grossCostUsd!=null&&book?<PhantomPredictBridge key={market.ticker+side+contracts} ticker={market.ticker} side={side} contracts={contracts} grossUsd={planned.grossCostUsd} quotedAt={book.asOf}/>:null}{eventMarketUrl(market.event || market.ticker)?<a href={eventMarketUrl(market.event || market.ticker)!} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs">Open venue to review/sign <ArrowUpRight className="size-4"/></a>:null}</>:null}
   </section>
   <section className={box}>
    <p className="font-mono text-[10px] tracking-widest text-cyan-300">PRODUCT BUILDER / RESEARCH ONLY</p><h2 className="mt-2 text-xl font-semibold">Turn events into useful scenarios</h2>
    <div className="mt-3 grid gap-2">{EVENT_TEMPLATES.map(t=><button key={t.id} type="button" onClick={()=>setTemplate(t.id)} className={`rounded-xl border p-3 text-left ${template===t.id?"border-cyan-300/40 bg-cyan-300/10":"border-white/10 bg-white/[.025]"}`}><span className="block text-sm font-semibold">{t.name}</span><span className="mt-1 block text-[11px] text-white/45">{t.product}</span></button>)}</div>
    <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs"><p className="font-semibold text-amber-200">{product?.ready?"Scenario passes research budget":"Scenario not ready"}</p><p className="mt-2 text-white/60">{product?.reason||"Select a live market and compatible event. No position is opened."}</p><p className="mt-2 text-amber-100/70">{selected.caution}</p></div>
   </section>
  </div>
 </div>
 <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-[#101726] p-4 text-xs leading-relaxed text-white/55"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300"/>Senda currently reads public Kalshi market data only. This does not read Phantom's Kalshi positions or authorize in-app execution. A weather event contract is not an insurance policy, and event settlement may differ from your real-world loss. Always verify market rules, fees, jurisdiction and the venue identity before trading.</p>
 </div>;
}
