import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, CircleAlert, Eye, RefreshCw, Search, ShieldCheck, Star, TrendingUp } from "lucide-react";
import { LiveChart } from "@/components/price-chart";
import { NativeVolumePanel } from "@/components/native-volume-panel";
import { getPrint, type PrintBar, type PrintTf } from "@/lib/print";
import { inspectMarketQuality, shortlistMarkets, type QualityResult } from "@/lib/market-quality.mjs";
import type { HouseListing } from "@/lib/sol-house";
import type { TapeRow } from "@/lib/world-book";
type Market = {mint:string;symbol:string;name:string;venue:string;price:number|null;changePct:number|null;
 liquidityUsd:number|null;volume24hUsd:number|null;organicScore:number|null;verified:boolean;updatedAt:string|null};
const WATCH="senda.market-intel.watch.v1";
const fmt=(n:number|null|undefined,d=2)=>n==null||!Number.isFinite(n)?"—":n>=1? n.toLocaleString("en-US",{maximumFractionDigits:d}):n.toPrecision(4);
const money=(n:number|null|undefined)=>n==null||!Number.isFinite(n)?"—":"$"+(n>=1e6?(n/1e6).toFixed(2)+"m":n>=1e3?(n/1e3).toFixed(1)+"k":fmt(n));
const statusLabel:Record<string,string>={
 verified:"Pool OHLCV verified",stale:"Stale market feed",insufficient:"Limited history",
 "price-only":"Price-only source","volume-unverified":"Volume unavailable","no-data":"No candles"
};
function normalizedPercent(n:number|null|undefined){if(n==null||!Number.isFinite(n))return null;return Math.abs(n)<=2?n*100:n;}
function qualityColor(status:string){return status==="verified"?"text-cyan-200 border-cyan-300/30 bg-cyan-300/10":"text-amber-200 border-amber-300/25 bg-amber-300/10";}
export function MarketIntelligence({house,tape,embedded=false}:{house:HouseListing[];tape:TapeRow[];embedded?:boolean}){
 const [query,setQuery]=useState("");
 const [venue,setVenue]=useState<"all"|"spot"|"prestocks">("all");
 const [order,setOrder]=useState<"movers"|"volume"|"liquidity">("movers");
 const [minLiquidity,setMinLiquidity]=useState(0);
 const [focus,setFocus]=useState("");
 const [tf,setTf]=useState<PrintTf>("1H");
 const [refresh,setRefresh]=useState(0);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [bars,setBars]=useState<PrintBar[]>([]);
 const [source,setSource]=useState("");
 const [sampleAt,setSampleAt]=useState(0);
 const [watch,setWatch]=useState<string[]>([]);
 const [scanning,setScanning]=useState(false);
 const [scan,setScan]=useState<Array<{mint:string;status:string;alignment:number;relativeVolume:number|null}>>([]);
 const candidates=useMemo(()=>{
  // HouseListing contains historic catalogue fallback figures; never present those as live quotes.
  const byMint = new Map(tape.filter(t=>t.price!=null&&t.price>0).map(t=>[t.id,t]));
  const pre:Market[]=house.filter(h=>h.venue==="prestocks"&&h.mint)
   .map(h=>{
    const live=byMint.get(h.mint);
    return {mint:h.mint,symbol:h.symbol,name:h.name,venue:"prestocks",
      price:live?.price??null,changePct:live?.changePct??null,
      liquidityUsd:live?.liquidityUsd??null,volume24hUsd:live?.volume24hUsd??null,
      organicScore:live?.organicScore??null,verified:live?.verified===true,updatedAt:live?.updatedAt??null};
   });
  const coins:Market[]=tape.filter(t=>t.id&&t.price!=null&&t.price>0)
   .map(t=>({mint:t.id,symbol:t.symbol,name:t.name,venue:"spot",price:t.price,changePct:t.changePct??null,
    liquidityUsd:t.liquidityUsd??null,volume24hUsd:t.volume24hUsd??null,
    organicScore:t.organicScore??null,verified:t.verified===true,updatedAt:t.updatedAt??null}));
  return shortlistMarkets([...pre,...coins],"",250);
 },[house,tape]);
 const matches=useMemo(()=>{
  const filtered=candidates.filter(c=>(venue==="all"||c.venue===venue)&&
    (!minLiquidity || (c.liquidityUsd!=null && c.liquidityUsd>=minLiquidity)));
  const rows=shortlistMarkets(filtered,query,250);
  return rows.sort((a,b)=>{
   if(order==="volume")return (b.volume24hUsd??-1)-(a.volume24hUsd??-1);
   if(order==="liquidity")return (b.liquidityUsd??-1)-(a.liquidityUsd??-1);
   return Math.abs(b.changePct??-1)-Math.abs(a.changePct??-1);
  }).slice(0,80);
 },[candidates,query,venue,order,minLiquidity]);
 const chosen=candidates.find(c=>c.mint===focus)??matches[0]??null;
 useEffect(()=>{
  const preferred=window.sessionStorage.getItem("senda.market.focus");
  if(preferred && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(preferred))setFocus(preferred);
  window.sessionStorage.removeItem("senda.market.focus");
 },[]);
 useEffect(()=>{
  try{
   const stored=JSON.parse(window.localStorage.getItem(WATCH)||"[]");
   if(Array.isArray(stored))setWatch(stored.filter(v=>typeof v==="string"&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)).slice(0,40));
  }catch{setWatch([]);}
 },[]);
 useEffect(()=>{
  if(!chosen?.mint){setBars([]);setSource("");setError("");return;}
  let active=true;
  setLoading(true);setError("");setBars([]);setSource("");
  getPrint({data:{mint:chosen.mint,tf}})
   .then(out=>{if(!active)return;setBars(out.bars);setSource(out.note);setSampleAt(Date.now());})
   .catch(err=>{if(!active)return;setError(err instanceof Error?err.message:"Market feed unavailable.");})
   .finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[chosen?.mint,tf,refresh]);
 const model:QualityResult=useMemo(()=>inspectMarketQuality({
  bars,source:source.startsWith("Pool OHLCV")?"gecko-pool":"price-only",tf,now:sampleAt||Date.now()
 }),[bars,source,tf,sampleAt]);
 const linked=chosen?.mint&&watch.includes(chosen.mint);
 function toggleWatch(){
  if(!chosen)return;
  const next=watch.includes(chosen.mint)?watch.filter(x=>x!==chosen.mint):[chosen.mint,...watch].slice(0,40);
  try{window.localStorage.setItem(WATCH,JSON.stringify(next));setWatch(next);}catch{setError("Watchlist could not be saved to this browser.");}
 }
 async function scanShortlist(){
  if(scanning)return;
  setScanning(true);setScan([]);setError("");
  const top=[...candidates.filter(c=>watch.includes(c.mint)),...matches].filter((x,i,arr)=>arr.findIndex(y=>y.mint===x.mint)===i).slice(0,6);
  const result:Array<{mint:string;status:string;alignment:number;relativeVolume:number|null}>=[];
  // Capped manual scan. No recurring requests or invented multi-venue depth.
  for(const c of top){
   try{
    const out=await getPrint({data:{mint:c.mint,tf}});
    const signal=inspectMarketQuality({bars:out.bars,source:out.note.startsWith("Pool OHLCV")?"gecko-pool":"price-only",tf});
    result.push({mint:c.mint,status:signal.status,alignment:signal.alignment,relativeVolume:signal.relativeVolume});
   }catch{result.push({mint:c.mint,status:"no-data",alignment:0,relativeVolume:null});}
   setScan([...result]);
  }
  setScanning(false);
 }
 const topSignals=[...scan].sort((a,b)=>b.alignment-a.alignment);
 const age=model.ageMs==null?"—":Math.round(model.ageMs/60000)+" min";
 return <section className={`space-y-4 ${embedded?"":"px-3 py-4 lg:px-5"}`}>
  <header className="overflow-hidden rounded-[24px] border border-cyan-400/20 bg-[radial-gradient(ellipse_at_90%_-15%,#173f56_0%,#0b1424_45%,#070d18_90%)] p-4 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div><p className="font-mono text-[10px] tracking-[.24em] text-cyan-300">SENDA / MARKET INTELLIGENCE</p><h2 className="mt-1 text-2xl font-semibold sm:text-3xl">The Matrix</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/55">Compare actual pool volume, trend, relative activity and volatility. Research first. Live quote, route economics and wallet signing remain separate.</p></div>
    <div className="flex flex-wrap items-center gap-2">
     <button type="button" disabled={scanning||!candidates.length} onClick={()=>void scanShortlist()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-300/30 px-4 text-xs font-semibold text-cyan-200 disabled:opacity-40"><Activity className="size-4"/>{scanning?"Scanning up to six…":"Scan 6 markets"}</button>
     <Link to="/invest" onClick={()=>{if(chosen)window.sessionStorage.setItem("senda.market.focus",chosen.mint);}} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-bold text-[#081522]">Open Trade<ArrowUpRight className="size-4"/></Link>
    </div>
   </div>
   <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
    {[["Universe",String(candidates.length)],["Analyzed OHLCV",String(model.barCount)],["Data source",model.status==="verified"?"POOL OHLCV":"NOT VERIFIED"],["Scanner",scanning?"RUNNING":scan.length?scan.length+" checked":"MANUAL"]].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="font-mono text-[10px] text-white/45">{label}</p><p className="mt-1 text-sm font-semibold text-white/90">{value}</p></div>)}
   </div>
  </header>
  <div className="grid gap-4 xl:grid-cols-[minmax(260px,330px)_minmax(0,1fr)]">
   <aside className="min-w-0 rounded-[20px] border border-white/10 bg-[#0e1624] p-3">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Markets scanner</h3><span className="font-mono text-[10px] text-white/35">{matches.length} shown</span></div>
    <div className="relative mt-3"><Search className="absolute top-3 left-3 size-4 text-white/40"/><input aria-label="Find market" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Token, company, market…" className="min-h-10 w-full rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-xs outline-none focus:border-cyan-300/50"/></div>
    <div className="mt-2 flex gap-1">{([["all","All"],["spot","Solana"],["prestocks","PreStocks"]] as const).map(([v,label])=><button type="button" key={v} onClick={()=>{setVenue(v);setFocus("");}} className={`min-h-9 flex-1 rounded-lg px-2 text-[11px] ${venue===v?"bg-cyan-300 text-[#07121b]":"bg-white/5 text-white/60"}`}>{label}</button>)}</div>
    <div className="mt-2 grid grid-cols-2 gap-2">
     <label className="text-[10px] text-white/45">Rank by
      <select value={order} onChange={e=>setOrder(e.target.value as typeof order)} className="mt-1 min-h-9 w-full rounded-lg border border-white/15 bg-[#182334] px-2 text-xs text-white">
       <option value="movers">24h movers</option><option value="volume">Jupiter 24h volume</option><option value="liquidity">Jupiter liquidity</option>
      </select>
     </label>
     <label className="text-[10px] text-white/45">Minimum reported liquidity
      <select value={minLiquidity} onChange={e=>setMinLiquidity(Number(e.target.value))} className="mt-1 min-h-9 w-full rounded-lg border border-white/15 bg-[#182334] px-2 text-xs text-white">
       <option value={0}>Any / unreported</option><option value={50000}>$50k</option><option value={250000}>$250k</option><option value={1000000}>$1m</option>
      </select>
     </label>
    </div>
    <div className="mt-3 max-h-[510px] space-y-1 overflow-y-auto pr-1">
     {matches.map(item=>{const active=item.mint===chosen?.mint;return <button type="button" key={item.mint} onClick={()=>setFocus(item.mint)} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${active?"border-cyan-300/40 bg-cyan-300/10":"border-transparent bg-white/[0.025] hover:border-white/10"}`}>
      <div className="min-w-0"><p className="truncate text-xs font-semibold">{item.symbol}{watch.includes(item.mint)?<span className="ml-1 text-amber-300">★</span>:null}</p><p className="truncate text-[10px] text-white/45">{item.venue==="prestocks"?"PreStock token":"Solana spot"} · {item.name}</p>
      <p className="mt-1 truncate font-mono text-[10px] text-white/35">24h vol {money(item.volume24hUsd)} · Liq {money(item.liquidityUsd)}</p></div>
      <div className="shrink-0 text-right"><p className="font-mono text-xs">{money(item.price)}</p><p className={`font-mono text-[10px] ${item.changePct==null?"text-white/35":item.changePct>=0?"text-emerald-300":"text-rose-300"}`}>{item.changePct==null?"24h —":(item.changePct>0?"+":"")+item.changePct.toFixed(1)+"%"}</p></div>
     </button>;})}
     {!matches.length?<p className="py-8 text-center text-xs text-white/40">No priced Solana markets matched.</p>:null}
    </div>
    <p className="mt-3 border-t border-white/10 pt-3 text-[10px] text-white/40">Sorts use Jupiter-reported token metrics when available. Unreported values remain blank. Neither venue-level 24h volume nor this scanner establishes executable depth. Six-market scan is manual.</p>
   </aside>
   <div className="min-w-0 space-y-3">
    <div className="rounded-[20px] border border-white/10 bg-[#0e1624] p-3 sm:p-4">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="font-mono text-[10px] tracking-widest text-cyan-300">SELECTED / {chosen?.venue.toUpperCase()??"NONE"}</p><h3 className="mt-1 text-xl font-semibold">{chosen?.symbol??"Choose a market"} <span className="text-sm font-normal text-white/40">{chosen?.name}</span></h3><p className="mt-1 font-mono text-sm">{money(chosen?.price)}</p></div>
      <div className="flex items-center gap-2">
       <select aria-label="Chart timeframe" className="min-h-10 rounded-xl border border-white/15 bg-[#182334] px-2 text-xs" value={tf} onChange={e=>setTf(e.target.value as PrintTf)}>{(["15m","1H","4H","1D"] as const).map(t=><option key={t} value={t}>{t}</option>)}</select>
       <button type="button" title="Refresh selected market" aria-label="Refresh selected market" onClick={()=>setRefresh(n=>n+1)} className="grid size-10 place-items-center rounded-xl border border-white/10"><RefreshCw className={`size-4 ${loading?"animate-spin":""}`}/></button>
       <button type="button" title={linked?"Remove watch":"Watch market"} aria-label={linked?"Remove watch":"Watch market"} onClick={toggleWatch} className="grid size-10 place-items-center rounded-xl border border-white/10"><Star className={`size-4 ${linked?"fill-amber-300 text-amber-300":"text-white/60"}`}/></button>
      </div>
     </div>
     <div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-[10px] ${qualityColor(model.status)}`}>{statusLabel[model.status]??model.status}</span><span className="font-mono text-[10px] text-white/45">{source||"Awaiting candle source"} · latest bar {age} old</span></div>
     {chosen?.venue==="prestocks"&&chosen.price==null?
      <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-200">PreStock catalogue listing only. No independent current Jupiter quote was returned for this mint. Historical seeded marks are not shown as live prices.</p>:null}
     {chosen?.venue==="spot"?<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[["Jupiter 24h volume",money(chosen.volume24hUsd)],["Jupiter liquidity",money(chosen.liquidityUsd)],["Organic score",chosen.organicScore==null?"—":chosen.organicScore.toFixed(0)+"/100"],["Provider update",chosen.updatedAt?new Date(chosen.updatedAt).toLocaleTimeString():"Unreported"]].map(([label,val])=><div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-2"><p className="text-[10px] text-white/45">{label}</p><p className="mt-1 font-mono text-xs">{val}</p></div>)}
     </div>:null}
     {error?<p className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-xs text-rose-200">{error}</p>:null}
     {chosen?.mint?<div className="mt-3 rounded-xl border border-white/10 bg-[#070c16] p-2"><LiveChart mint={chosen.mint} symbol={chosen.symbol} live={chosen.price??undefined}/></div>:null}
     {chosen?.mint?<div className="mt-4"><NativeVolumePanel key={chosen.mint} mint={chosen.mint} symbol={chosen.symbol} initialTf={tf}/></div>:null}
    </div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
     {[["Last candle volume",money(model.lastVolumeUsd)],["Rel. volume / 20",model.relativeVolume==null?"—":model.relativeVolume.toFixed(2)+"×"],["Rolling VWAP 20",money(model.vwap20)],["ATR 14 / close",model.atrPct==null?"—":model.atrPct.toFixed(2)+"%"],["EMA 9",money(model.ema9)],["EMA 21",money(model.ema21)],["RSI 14",model.rsi14==null?"—":model.rsi14.toFixed(1)],["Condition alignment",model.status==="verified"?model.alignment+"/100":"NOT SCORED"]].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-[#0e1624] p-3"><p className="text-[10px] text-white/45">{label}</p><p className="mt-1 font-mono text-sm text-white">{value}</p></div>)}
    </div>
    <div className="rounded-[20px] border border-white/10 bg-[#0e1624] p-4">
     <div className="flex items-center justify-between gap-2"><div><p className="font-mono text-[10px] text-cyan-300">STRATEGY RESEARCH</p><h3 className="mt-1 text-base font-semibold">Evidence matrix</h3></div><span className="text-[11px] text-white/45">No execution authority</span></div>
     {model.status==="verified" ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{model.checks.map(x=>typeof x==="string"?<p key={x} className="text-xs text-white/60">{x}</p>:<div key={x.name} className="flex items-start gap-2 rounded-xl border border-white/10 p-3">{x.pass?<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300"/>:<CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300"/>}<div><p className="text-xs font-semibold">{x.name}</p><p className="mt-1 text-[11px] text-white/50">{x.detail}</p></div></div>)}</div>:
      <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs text-amber-200">Market matrix held. {model.checks.filter(x=>typeof x==="string").join(" ")||"The source has insufficient trusted volume, freshness or history."} No signal ranking is shown.</p>}
     <p className="mt-3 text-[11px] text-white/45">VWAP and OBV are rolling OHLCV approximations from one pool, not consolidated exchange tape or aggressor-side trades. A score is not a prediction or instruction to buy.</p>
    </div>
   </div>
  </div>
  {scan.length?<section className="rounded-[20px] border border-white/10 bg-[#0e1624] p-4">
   <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Manual comparative scan</h3><span className="font-mono text-[10px] text-white/40">{scan.length} checked</span></div>
   <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{topSignals.map(s=>{const item=candidates.find(x=>x.mint===s.mint);return <button key={s.mint} type="button" onClick={()=>setFocus(s.mint)} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left">
    <div><p className="text-xs font-semibold">{item?.symbol??"Unknown"}</p><p className="mt-1 text-[10px] text-white/45">{statusLabel[s.status]??s.status}</p></div><div className="text-right font-mono text-xs text-cyan-200">{s.status==="verified"?s.alignment+"/100":"HELD"}<p className="mt-1 text-[10px] text-white/40">{s.relativeVolume==null?"No vol":s.relativeVolume.toFixed(2)+"×"}</p></div>
   </button>;})}</div>
  </section>:null}
  <p className="flex items-start gap-2 px-1 text-[11px] text-white/40"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-300"/>Senda does not operate a centralized order book. These analytics use observed pool candle data when available; executable size, routing, spreads and final settlement must be verified through the actual execution venue and user wallet.</p>
 </section>;
}
