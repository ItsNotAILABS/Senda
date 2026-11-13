import {useEffect,useMemo,useState} from "react";
import {Link} from "@tanstack/react-router";
import {
 Activity,ArrowRight,ArrowUpRight,Bookmark,BookmarkCheck,CalendarClock,
 CheckCircle2,ChevronRight,Compass,ExternalLink,Globe2,Layers3,
 LoaderCircle,RefreshCw,Search,ShieldAlert,ShieldCheck,SlidersHorizontal,
 Sparkles,TrendingUp,Wallet,Info
} from "lucide-react";
import {cn} from "@/lib/utils";
import {kalshiPage,type KalshiRow} from "@/lib/kalshi-book";
import {getKalshiDepth} from "@/lib/kalshi-depth";
import {getKalshiContractDetail,type KalshiDetailResult} from "@/lib/kalshi-market-detail";
import {MARKET_LANES,marketSpread,type MarketLane,type SortMode} from "@/lib/event-market-discovery.mjs";
import {planEventSide,eventMarketUrl,type EventBook,type EventQuote} from "@/lib/event-contract-router.mjs";
import {EventContingencyLab} from "@/components/event-contingency-lab";
import {KalshiHistoryChart} from "@/components/kalshi-history-chart";
import {PhantomPredictBridge} from "@/components/phantom-predict-bridge";
import {DflowPhantomPrediction} from "@/components/dflow-phantom-prediction";
import {PredictionVenueRouter} from "@/components/prediction-venue-router";
import {PolymarketPublicDiscovery} from "@/components/polymarket-public-discovery";

type Workspace="markets"|"contingency"|"venues";
type VenueId="kalshi-public"|"phantom-us"|"dflow"|"world"|"polymarket";
const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const compact=(n:number)=>new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:1}).format(n);
const price=(n:number|null|undefined)=>n==null||!Number.isFinite(n)?"—":Math.round(n*10000)/100+"¢";
const timestamp=(text:string|null|undefined)=>{
 if(!text)return "Unknown";
 const t=Date.parse(text);
 return Number.isFinite(t)?new Date(t).toLocaleString():"Unknown";
};
const pane="rounded-[24px] border border-white/10 bg-[#0c1523] shadow-[0_10px_34px_#03070e35]";
const stat="rounded-xl border border-white/[.075] bg-black/20 p-3";

export function EventMarketsDesk({initialWorkspace="markets"}:{initialWorkspace?:Workspace}={}){
 const [workspace,setWorkspace]=useState<Workspace>(initialWorkspace);
 const [venue,setVenue]=useState<VenueId>("kalshi-public");
 const [query,setQuery]=useState("");
 const [debouncedQuery,setDebouncedQuery]=useState("");
 const [lane,setLane]=useState<MarketLane>("all");
 const [sort,setSort]=useState<SortMode>("activity");
 const [savedOnly,setSavedOnly]=useState(false);
 const [watchlist,setWatchlist]=useState<string[]>([]);
 const [watchlistReady,setWatchlistReady]=useState(false);
 const watchlistKey=watchlist.join("|");
 const [rows,setRows]=useState<KalshiRow[]>([]);
 const [market,setMarket]=useState<KalshiRow|null>(null);
 const [book,setBook]=useState<EventBook|null>(null);
 const [contract,setContract]=useState<KalshiDetailResult|null>(null);
 const [side,setSide]=useState<"yes"|"no">("yes");
 const [contracts,setContracts]=useState(5);
 const [budget,setBudget]=useState(40);
 const [total,setTotal]=useState(0);
 const [loaded,setLoaded]=useState(0);
 const [done,setDone]=useState(false);
 const [observedAt,setObservedAt]=useState<string|null>(null);
 const [page,setPage]=useState(0);
 const [loading,setLoading]=useState(false);
 const [loadingDepth,setLoadingDepth]=useState(false);
 const [loadingRules,setLoadingRules]=useState(false);
 const [note,setNote]=useState("Connecting to Kalshi's public market index…");
 const [depthNote,setDepthNote]=useState("Select a market for source-backed depth.");
 const [stamp,setStamp]=useState(0);
 const [clock,setClock]=useState(Date.now());

 useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),10000);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{const timer=window.setTimeout(()=>setDebouncedQuery(query.trim().slice(0,80)),250);return()=>window.clearTimeout(timer);},[query]);
 useEffect(()=>{
  try{
   const parsed=JSON.parse(window.localStorage.getItem("senda.kalshi.watchlist.v1")||"[]");
   if(Array.isArray(parsed))setWatchlist(parsed.filter((x):x is string=>typeof x==="string"&&TICKER.test(x)).slice(0,70));
  }catch{setWatchlist([]);}
  setWatchlistReady(true);
 },[]);
 useEffect(()=>{if(!watchlistReady)return;try{window.localStorage.setItem("senda.kalshi.watchlist.v1",JSON.stringify(watchlist.slice(0,70)));}catch{/* no browser storage: research remains available */}},[watchlist,watchlistReady]);
 useEffect(()=>{setPage(0);setRows([]);setMarket(null);setBook(null);setContract(null);},[debouncedQuery,lane,sort,savedOnly,watchlistKey]);
 useEffect(()=>{
  let active=true;setLoading(true);
  void kalshiPage({data:{q:debouncedQuery,category:"",lane,sort,watchlist:savedOnly?watchlist:undefined,offset:page,limit:40}})
   .then(result=>{
    if(!active)return;
    setRows(prev=>page===0?result.rows:[...prev.filter(x=>!result.rows.some(v=>v.ticker===x.ticker)),...result.rows]);
    if(page===0&&result.rows.length)setMarket(current=>current||result.rows[0]);
    setTotal(result.total);setLoaded(result.loaded);setDone(result.done);setObservedAt(result.observedAt);
    setNote(result.loaded?result.total.toLocaleString()+" matches in the currently indexed public feed":
     "Kalshi market index is unavailable or still loading. No fallback contracts are shown.");
   }).catch(()=>{if(active){if(page===0)setRows([]);setNote("Public market data unavailable. Retry when Kalshi responds.");}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;};
 },[debouncedQuery,lane,sort,page,stamp,savedOnly,watchlistKey]);
 useEffect(()=>{
  if(!market){setBook(null);setContract(null);return;}
  let active=true;setBook(null);setContract(null);setLoadingDepth(true);setLoadingRules(true);
  setDepthNote("Checking actual public opposing bids…");
  void getKalshiDepth({data:{ticker:market.ticker}})
   .then(out=>{if(active){setBook(out.book);setDepthNote(out.reason);}})
   .catch(()=>{if(active)setDepthNote("Live opposing bids could not be verified.");})
   .finally(()=>{if(active)setLoadingDepth(false);});
  void getKalshiContractDetail({data:{ticker:market.ticker}})
   .then(out=>{if(active)setContract(out);})
   .catch(()=>{if(active)setContract({state:"unavailable",detail:null,reason:"Market rules unavailable."});})
   .finally(()=>{if(active)setLoadingRules(false);});
  return()=>{active=false;};
 },[market?.ticker,stamp]);
 const displayed=rows;
 const planned=useMemo<EventQuote|null>(()=>book?planEventSide(book,side,contracts,clock):null,[book,side,contracts,clock]);
 const sourceReady=Boolean(book&&clock>=book.asOf&&clock-book.asOf<=30000);
 const totalVolume=useMemo(()=>rows.reduce((acc,r)=>acc+(r.reportedVolume??0),0),[rows]);
 const watchlisted=market?watchlist.includes(market.ticker):false;
 function toggleWatch(ticker:string){
  if(!TICKER.test(ticker))return;
  setWatchlist(previous=>previous.includes(ticker)?previous.filter(x=>x!==ticker):[...previous.slice(-69),ticker]);
 }
 function chooseMarket(row:KalshiRow){setMarket(row);setSide("yes");setContracts(5);}
 function findKeyword(keyword:string){
  setQuery(keyword);setDebouncedQuery(keyword);setLane("all");setSavedOnly(false);setWorkspace("markets");setPage(0);
 }
 const activity=market?.reportedVolume??null;
 return <div className="mx-auto max-w-[1710px] space-y-4 px-3 pb-14 pt-4 text-white sm:px-5 lg:px-7">
  <header className="relative overflow-hidden rounded-[30px] border border-cyan-300/20 bg-[radial-gradient(ellipse_at_90%_-15%,#174d60_0%,#0d1e31_40%,#070b13_85%)] p-5 sm:p-8">
   <div className="pointer-events-none absolute right-7 top-6 hidden select-none font-mono text-[10px] tracking-[.32em] text-cyan-200/20 md:block">BYOW / MARKET INTELLIGENCE</div>
   <div className="relative max-w-4xl">
    <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[.16em] text-cyan-200"><Activity className="size-3"/> SENDA PREDICTIONS</span><span className="rounded-full border border-emerald-300/20 px-3 py-1.5 font-mono text-[10px] text-emerald-200">LIVE PUBLIC MARKET SOURCES</span></div>
    <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">The event market desk.<br/><span className="text-cyan-200">Built around what matters.</span></h1>
    <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">Explore public Kalshi markets, read actual order-book depth and contract rules, and evaluate event-based contingency scenarios. Connect Phantom to review authorized signing paths without mixing separate account balances.</p>
   </div>
   <div className="relative mt-6 grid grid-cols-2 gap-2 lg:max-w-[900px] lg:grid-cols-4">
    <div className={stat}><p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Indexed contracts</p><p className="mt-1 font-mono text-xl font-semibold">{loaded?compact(loaded):"—"}</p><p className="mt-1 text-[10px] text-white/40">{done?"Index scan complete":"Partial public index"}</p></div>
    <div className={stat}><p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Current matches</p><p className="mt-1 font-mono text-xl font-semibold">{total?compact(total):"—"}</p><p className="mt-1 text-[10px] text-white/40">Catalog, not resting liquidity</p></div>
    <div className={stat}><p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Loaded 24h volume</p><p className="mt-1 font-mono text-xl font-semibold">{totalVolume?compact(totalVolume):"—"}</p><p className="mt-1 text-[10px] text-white/40">Contract count, visible rows only</p></div>
    <div className={stat}><p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Venue signing</p><p className="mt-1 flex items-center gap-2 text-lg font-semibold text-cyan-200"><ShieldCheck className="size-4"/>Wallet-gated</p><p className="mt-1 text-[10px] text-white/40">Research is never a trade</p></div>
   </div>
   <div className="relative mt-6 flex flex-wrap gap-2">
    {([
     ["markets","Market Terminal",Compass],["contingency","Contingency Lab",ShieldAlert],["venues","Phantom & Venues",Wallet]
    ] as const).map(([id,label,Icon])=><button type="button" key={id} onClick={()=>setWorkspace(id)} aria-pressed={workspace===id}
      className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition",
       workspace===id?"border-cyan-300/40 bg-cyan-300 text-[#061521]":"border-white/15 bg-black/20 text-white/70 hover:border-cyan-300/35")}>
      <Icon className="size-4"/>{label}</button>)}
    <Link to="/liquify" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs text-white/65">Liquify <ArrowRight className="size-3"/></Link>
   </div>
  </header>
  {workspace==="contingency"?<EventContingencyLab market={market} planned={planned} chosenSide={side} budget={budget} clock={clock} onBudget={setBudget} onKeyword={findKeyword}/>:null}
  {workspace==="venues"?<>
   <PredictionVenueRouter selected={venue} onChange={setVenue}/>
   {venue==="polymarket"?<PolymarketPublicDiscovery/>:
    <div className={cn(pane,"space-y-3 p-5")}>
     <h2 className="text-lg font-semibold">{venue==="dflow"?"Solana outcome tokens / Phantom signing":"Provider-specific execution"}</h2>
     <p className="text-xs leading-6 text-white/55">{venue==="dflow"?"DFlow is a distinct Solana-native outcome-token lane. It requires actual provider keys, Proof identity, jurisdiction approval, verified market mints and reviewed Solana programs. Senda leaves production signing off until those gates pass.":"A Phantom wallet cannot directly sign a Kalshi exchange order in Senda. Phantom's native U.S. Predict experience manages its own account verification, funding and trading. Kalshi public research has no trading permission."}</p>
     {venue==="dflow"&&market?<DflowPhantomPrediction ticker={market.ticker}/>:null}
     {!market&&venue==="dflow"?<p className="rounded-xl bg-amber-300/[.07] p-4 text-xs text-amber-100">Select a real Kalshi ticker in Market Terminal first, then return here to verify whether a corresponding DFlow outcome-token route exists.</p>:null}
     <div className="flex flex-wrap gap-2"><a href="https://phantom.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-300/25 px-3 text-xs text-violet-200">Phantom official <ExternalLink className="size-3"/></a><button type="button" onClick={()=>setWorkspace("markets")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs">Return to live Kalshi catalog <ArrowRight className="size-3"/></button></div>
    </div>}
  </>:null}
  {workspace==="markets"?<div className="grid gap-4 xl:grid-cols-[minmax(330px,.92fr)_minmax(400px,1.2fr)_minmax(310px,.82fr)]">
   <section className={cn(pane,"min-w-0 overflow-hidden")}>
    <div className="border-b border-white/10 p-4 sm:p-5">
     <div className="flex items-center justify-between gap-2"><div><p className="font-mono text-[10px] tracking-[.18em] text-cyan-300">DISCOVER</p><h2 className="mt-1 text-xl font-semibold">Real Kalshi markets</h2></div><button type="button" onClick={()=>setStamp(s=>s+1)} disabled={loading} className="grid size-10 place-items-center rounded-xl border border-white/15 text-white/70 hover:border-cyan-300/40" aria-label="Refresh Kalshi markets"><RefreshCw className={cn("size-4",loading&&"animate-spin")}/></button></div>
     <label className="relative mt-4 block"><Search className="absolute left-3 top-3 size-4 text-white/35"/><input value={query} onChange={e=>setQuery(e.target.value)} maxLength={80} placeholder="Search events, series, tickers…" className="min-h-11 w-full rounded-xl border border-white/15 bg-[#132238] pl-10 pr-3 text-sm outline-none placeholder:text-white/30 focus:border-cyan-300/50"/></label>
     <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{MARKET_LANES.map(x=><button type="button" key={x.id} onClick={()=>setLane(x.id)} aria-pressed={lane===x.id} className={cn("min-h-9 shrink-0 rounded-full border px-3 text-[11px] font-medium",lane===x.id?"border-cyan-300/40 bg-cyan-300 text-[#071722]":"border-white/10 bg-white/[.04] text-white/60")}>{x.name}</button>)}</div>
     <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-[11px] text-white/55"><SlidersHorizontal className="size-3"/>Sort
       <select value={sort} onChange={e=>setSort(e.target.value as SortMode)} className="rounded-lg border border-white/10 bg-[#102033] p-1.5 text-xs text-white"><option value="activity">24h activity</option><option value="tight-spread">Tightest displayed spread</option><option value="closing">Closing first</option></select>
      </label>
      <button type="button" onClick={()=>setSavedOnly(x=>!x)} aria-pressed={savedOnly} className={cn("inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-[11px]",savedOnly?"border-cyan-300/40 text-cyan-200":"border-white/10 text-white/50")}><Bookmark className="size-3"/>Watchlist · {watchlist.length}</button>
     </div>
     <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[10px] text-white/40"><span>{loading?"Updating…":note}</span><span className="shrink-0">{observedAt?"Indexed "+timestamp(observedAt).split(",")[0]:"Awaiting source"}</span></div>
    </div>
    <div className="max-h-[760px] min-h-[260px] overflow-y-auto">
     {displayed.map(row=><div key={row.ticker} className={cn("group flex items-stretch border-b border-white/[.06] transition hover:bg-white/[.035]",market?.ticker===row.ticker&&"bg-cyan-300/[.055]")}>
      <button type="button" onClick={()=>chooseMarket(row)} className="min-w-0 flex-1 px-4 py-4 text-left sm:px-5">
       <div className="flex items-center justify-between gap-3"><span className="truncate font-mono text-[10px] text-cyan-200/75">{row.category||"Kalshi"} · {row.ticker}</span><ChevronRight className="size-4 shrink-0 text-white/25"/></div>
       <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-5">{row.yes||row.title}</p>
       <div className="mt-3 flex items-center justify-between gap-2"><span className="font-mono text-[11px] text-white/45">24h {row.reportedVolume==null?"unreported":compact(row.reportedVolume)} contracts</span><span className="font-mono text-[11px] text-cyan-200">YES {price(row.bid)} / {price(row.ask)}</span></div>
      </button>
      <button type="button" onClick={()=>toggleWatch(row.ticker)} aria-label={(watchlist.includes(row.ticker)?"Remove ":"Save ")+row.ticker} className="grid w-11 shrink-0 place-items-start pt-4 text-white/40 hover:text-cyan-200">{watchlist.includes(row.ticker)?<BookmarkCheck className="size-4 text-cyan-300"/>:<Bookmark className="size-4"/>}</button>
     </div>)}
     {!displayed.length&&!loading?<div className="px-6 py-12 text-center"><Compass className="mx-auto size-7 text-white/25"/><p className="mt-3 text-sm font-semibold">No sourced markets in this view</p><p className="mt-2 text-xs leading-5 text-white/45">{savedOnly?"Save some real tickers first.":"Try another topic, remove filters or let the public index finish scanning."}</p></div>:null}
    </div>
    {rows.length<total?<button type="button" disabled={loading} onClick={()=>setPage(p=>p+40)} className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-white/10 text-xs text-cyan-200 disabled:opacity-40">{loading?<LoaderCircle className="size-4 animate-spin"/>:<ArrowRight className="size-4"/>}Load more indexed contracts</button>:null}
    <p className="border-t border-white/10 px-4 py-3 text-[10px] leading-4 text-white/35">Topic groupings are Senda discovery heuristics, not Kalshi's official market taxonomy. Missing prices or volumes are never substituted with demo values.</p>
   </section>
   <section className={cn(pane,"min-w-0 space-y-4 p-4 sm:p-5")}>
    {!market?<div className="flex min-h-[520px] flex-col items-center justify-center text-center"><div className="grid size-16 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[.04]"><TrendingUp className="size-8 text-cyan-200"/></div><h2 className="mt-5 text-xl font-semibold">Inspect a real contract</h2><p className="mt-3 max-w-md text-xs leading-6 text-white/50">Select a Kalshi market for actual YES/NO opposing bid depth, fee-unknown cash-flow estimates, closing rules, a Phantom research signature and contingency scenarios.</p></div>:<>
     <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-[10px] tracking-[.16em] text-cyan-300">KALSHI / CONTRACT DETAIL</p><h2 className="mt-2 text-xl font-semibold leading-7">{market.yes||market.title}</h2><p className="mt-2 break-all font-mono text-[10px] text-white/40">{market.ticker}</p></div><button type="button" onClick={()=>toggleWatch(market.ticker)} aria-label="Toggle saved market" className="grid size-10 place-items-center rounded-xl border border-white/15">{watchlisted?<BookmarkCheck className="size-4 text-cyan-300"/>:<Bookmark className="size-4"/>}</button></div>
     <div className="grid grid-cols-3 gap-2"><div className={stat}><p className="text-[10px] text-white/40">YES bid</p><p className="mt-1 font-mono text-lg text-cyan-200">{price(market.bid)}</p></div><div className={stat}><p className="text-[10px] text-white/40">YES ask</p><p className="mt-1 font-mono text-lg">{price(market.ask)}</p></div><div className={stat}><p className="text-[10px] text-white/40">Displayed spread</p><p className="mt-1 font-mono text-lg">{marketSpread(market)==null?"—":marketSpread(market)+"¢"}</p></div></div>
     <KalshiHistoryChart ticker={market.ticker} seriesTicker={market.seriesTicker} refreshKey={stamp}/>
     <div className="rounded-2xl border border-cyan-300/15 bg-[#0e2130] p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] text-cyan-300">ORDERBOOK-BASED RESEARCH</p><h3 className="mt-1 text-base font-semibold">Size an event position</h3></div><span className={cn("rounded-full border px-2 py-1 font-mono text-[10px]",sourceReady?"border-emerald-300/25 text-emerald-200":"border-amber-300/25 text-amber-200")}>{loadingDepth?"Loading":sourceReady?"Depth fresh":"Unverified / stale"}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2">{(["yes","no"] as const).map(x=><button type="button" key={x} aria-pressed={side===x} onClick={()=>setSide(x)} className={cn("min-h-11 rounded-xl border text-sm font-semibold",side===x?x==="yes"?"border-emerald-300/35 bg-emerald-300/10 text-emerald-200":"border-rose-300/35 bg-rose-300/10 text-rose-200":"border-white/10 bg-white/[.04] text-white/50")}>Research {x.toUpperCase()}</button>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-[11px] text-white/50">Contracts <input type="number" min="1" max="1000" step="1" value={contracts} onChange={e=>setContracts(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111a2d] px-3 font-mono text-sm text-white outline-none"/></label><label className="text-[11px] text-white/50">Scenario budget ($) <input type="number" min="1" max="100000" step="1" value={budget} onChange={e=>setBudget(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111a2d] px-3 font-mono text-sm text-white outline-none"/></label></div>
      {planned?.available?<div className="mt-4 grid grid-cols-2 gap-2"><div className={stat}><p className="text-[10px] text-white/45">Estimated gross cost</p><p className="mt-1 font-mono text-xl font-semibold">{money(planned.grossCostUsd??0)}</p></div><div className={stat}><p className="text-[10px] text-white/45">Potential event payout</p><p className="mt-1 font-mono text-xl font-semibold text-emerald-300">{money(planned.maximumPayoutUsd??0)}</p></div></div>:<p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs leading-5 text-amber-200">{planned?.reason||depthNote}</p>}
      <p className="mt-3 text-[10px] leading-5 text-white/45">{depthNote} · Source: Kalshi public opposing bids · Actual venue fees, price slippage, and fills are unknown.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">{(["yes","no"] as const).map(x=>{
       const levels=x==="yes"?book?.yesBids:book?.noBids;
       const maximum=Math.max(1,...(levels||[]).slice(0,6).map(v=>v.size));
       return <div key={x}><p className="mb-2 font-mono text-[10px] text-white/40">{x.toUpperCase()} bids · {levels?.length??0}</p><div className="space-y-1.5">{(levels||[]).slice(0,6).map((v,i)=><div key={i} className="flex items-center gap-2"><span className="w-9 font-mono text-[10px] text-white/50">{price(v.bid/10000)}</span><div className="h-2.5 flex-1 overflow-hidden rounded bg-white/[.05]"><div className={cn("h-full rounded",x==="yes"?"bg-emerald-300/55":"bg-rose-300/55")} style={{width:(100*v.size/maximum)+"%"}}/></div><span className="w-10 text-right font-mono text-[10px] text-white/40">{compact(v.size)}</span></div>)}{!levels?.length?<p className="text-[11px] text-white/35">No sourced bids</p>:null}</div></div>
      })}</div>
     </div>
     <div className="rounded-xl border border-white/10 bg-black/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4 text-cyan-300"/>Contract terms & settlement</h3><span className="rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] text-white/45">{loadingRules?"Checking…":contract?.detail?.status??"Unavailable"}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]"><div><p className="text-white/35">Closes</p><p className="mt-1 text-white/70">{timestamp(contract?.detail?.closeTime||market.closeFull)}</p></div><div><p className="text-white/35">24h volume / open interest</p><p className="mt-1 text-white/70">{contract?.detail?.volume24hContracts==null?"—":compact(contract.detail.volume24hContracts)} / {contract?.detail?.openInterestContracts==null?"—":compact(contract.detail.openInterestContracts)}</p></div></div>
      {contract?.detail?.rulesPrimary?<details className="mt-3 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-xs font-semibold text-cyan-200">Read Kalshi settlement rules</summary><p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-white/60">{contract.detail.rulesPrimary}</p>{contract.detail.rulesSecondary?<p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-white/55">{contract.detail.rulesSecondary}</p>:null}</details>:<p className="mt-3 text-[11px] text-amber-200/70">{contract?.reason||"Fetching source rules…"}</p>}
      <p className="mt-3 text-[10px] text-white/35">Source: Kalshi public market metadata · Last checked {timestamp(contract?.detail?.observedAt)}. Contract terms and rules control over this preview.</p>
     </div>
     <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={()=>setWorkspace("contingency")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 text-xs font-semibold text-[#061521]"><ShieldAlert className="size-4"/>Contingency Lab</button>
      {eventMarketUrl(market.event||market.ticker)?<a href={eventMarketUrl(market.event||market.ticker)!} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 text-xs text-white/65">Kalshi official <ExternalLink className="size-3"/></a>:null}
     </div>
    </>}
   </section>
   <aside className="min-w-0 space-y-4">
    <section className={cn(pane,"p-4 sm:p-5")}>
     <p className="font-mono text-[10px] tracking-widest text-cyan-300">WALLET & EXECUTION</p><h3 className="mt-2 text-lg font-semibold">Trade where authority exists.</h3>
     <p className="mt-2 text-[11px] leading-5 text-white/50">Phantom app accounts, Kalshi exchange funds, and Solana DFlow outcome tokens are separate. Senda doesn't turn a research signature into an order.</p>
     <div className="mt-4 space-y-2">
      <button type="button" onClick={()=>{setVenue("phantom-us");setWorkspace("venues");}} className="flex w-full items-center justify-between gap-2 rounded-xl border border-violet-300/25 bg-violet-300/[.055] p-3 text-left">
       <span><span className="flex items-center gap-2 text-xs font-semibold"><Wallet className="size-4 text-violet-200"/>Phantom native Kalshi</span><span className="mt-1 block text-[10px] text-white/45">Trade in Phantom after Kalshi approval</span></span><ArrowUpRight className="size-4 text-violet-200"/>
      </button>
      <button type="button" onClick={()=>{setVenue("dflow");setWorkspace("venues");}} className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.04] p-3 text-left">
       <span><span className="flex items-center gap-2 text-xs font-semibold"><Activity className="size-4 text-emerald-200"/>DFlow Solana outcome route</span><span className="mt-1 block text-[10px] text-white/45">Separate Phantom-signed transaction · provider-gated</span></span><ChevronRight className="size-4 text-emerald-200"/>
      </button>
     </div>
    </section>
    {market&&planned?.available&&typeof planned.grossCostUsd==="number"&&typeof book?.asOf==="number"?<PhantomPredictBridge key={market.ticker+side+contracts} ticker={market.ticker} side={side} contracts={contracts} grossUsd={planned.grossCostUsd} quotedAt={book.asOf}/>:null}
    <section className={cn(pane,"p-4 sm:p-5")}>
     <h3 className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="size-4 text-cyan-300"/>The Senda money stack</h3>
     <div className="mt-3 space-y-2">{([
      {href:"/liquify",name:"Liquify",about:"Venue-by-venue liquidity research"},
      {href:"/payments",name:"Pay & Send",about:"Wallet-approved transfers"},
      {href:"/agents/intelligence",name:"Utility AI",about:"Public-source market and risk analysis"},
      {href:"/pre/cover",name:"PreStock Cover",about:"Separate token downside feature"}
     ] as const).map(x=><Link key={x.href} to={x.href} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[.025] px-3 text-xs hover:border-cyan-300/30"><span><strong className="block">{x.name}</strong><span className="mt-1 block text-[10px] text-white/40">{x.about}</span></span><ArrowRight className="size-3 text-cyan-200"/></Link>)}</div>
    </section>
    <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-[11px] leading-5 text-white/55"><Info className="mr-1 inline size-3.5 text-amber-200"/>Senda is not offering insurance, indemnity, insurance claims, guaranteed settlement or third-party Kalshi account execution. All event-price research is non-custodial and fee-incomplete.</p>
   </aside>
  </div>:null}
  <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1320] px-4 py-3 text-[11px] text-white/40">
   <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300"/>Public facts first · no synthetic liquidity · explicit wallet approval</span>
   <span>Kalshi + Phantom + DFlow are independent financial ecosystems. Eligibility and regulations apply.</span>
  </footer>
 </div>;
}
