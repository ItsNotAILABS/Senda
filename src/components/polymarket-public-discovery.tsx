import {useEffect,useState} from "react";
import {ExternalLink,RefreshCw,Search} from "lucide-react";
import {getPolymarketPublicMarkets} from "@/lib/polymarket-catalog";
import {polymarketMarketUrl,type PolymarketCatalogRow} from "@/lib/polymarket-catalog.mjs";
import {getPolymarketPublicDepth} from "@/lib/polymarket-depth";
import {planPolymarketBuy,type PolymarketBook} from "@/lib/polymarket-depth.mjs";
function PolymarketDepthPreview({market}:{market:PolymarketCatalogRow}){
 const [index,setIndex]=useState(0),[shares,setShares]=useState(5),[book,setBook]=useState<PolymarketBook|null>(null);
 const [loading,setLoading]=useState(false),[note,setNote]=useState("Select an outcome to inspect its public CLOB offers.");
 const [tick,setTick]=useState(0),[clock,setClock]=useState(Date.now());
 const token=market.tokenIds[index];
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),10000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{
  setBook(null);
  if(!token||!/^\\d{20,100}$/.test(token)){setNote("This market has no source-verified outcome token identifier.");return;}
  let active=true;setLoading(true);
  void getPolymarketPublicDepth({data:{tokenId:token}})
   .then(r=>{if(active){setBook(r.book);setNote(r.reason);}})
   .catch(()=>{if(active)setNote("CLOB book unavailable.")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[token,tick]);
 const result=book?planPolymarketBuy(book,shares,clock):null;
 return <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-3">
  <p className="font-mono text-[10px] text-cyan-200">LIVE CLOB DEPTH / READ-ONLY</p>
  <div className="mt-2 flex flex-wrap gap-2">{market.outcomes.map((o,i)=><button key={o} type="button" onClick={()=>setIndex(i)} className={`min-h-9 rounded-lg border px-3 text-xs ${index===i?"border-cyan-300/50 text-cyan-200":"border-white/10 text-white/55"}`}>{o}</button>)}</div>
  <div className="mt-3 flex items-center gap-3"><label className="text-[11px] text-white/55">Shares<input type="number" min="1" max="1000" step="1" value={shares} onChange={e=>setShares(Number(e.target.value))} className="ml-2 h-9 w-20 rounded-lg border border-white/15 bg-black/25 px-2 text-xs"/></label><button onClick={()=>setTick(v=>v+1)} disabled={loading} className="min-h-9 rounded-lg border border-white/10 px-3 text-xs" type="button">Refresh CLOB</button></div>
  <p className="mt-2 text-[11px] text-white/45">{loading?"Reading venue book…":note}</p>
  {result?.available?<div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-black/20 p-2"><p className="text-[10px] text-white/45">Observed gross cost</p><p className="font-mono text-lg text-cyan-200">${result.grossCostUsd!.toFixed(2)} USD</p></div><div className="rounded-lg bg-black/20 p-2"><p className="text-[10px] text-white/45">Average share price</p><p className="font-mono text-lg">${result.averagePriceUsd!.toFixed(4)}</p></div></div>:<p className="mt-3 text-[11px] text-amber-100/80">{result?.reason||"No current sourced buy-depth estimate."}</p>}
  <p className="mt-3 text-[11px] leading-relaxed text-white/45">These are public asks from the selected Polymarket outcome token, not Kalshi prices or a Phantom Cash order. Fees unknown; no authenticated quote, position or trade.</p>
 </div>;
}
export function PolymarketPublicDiscovery(){
 const [rows,setRows]=useState<PolymarketCatalogRow[]>([]);
 const [loading,setLoading]=useState(false);
 const [reason,setReason]=useState("");
 const [query,setQuery]=useState("");
 const [epoch,setEpoch]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 useEffect(()=>{
  let live=true;
  setLoading(true);
  void getPolymarketPublicMarkets({data:{limit:40}})
    .then(res=>{if(!live)return;setRows(res.rows);setReason(res.note);})
    .catch(()=>{if(live){setRows([]);setReason("Public market discovery unavailable.");}})
    .finally(()=>{if(live)setLoading(false)});
  return ()=>{live=false};
 },[epoch]);
 const filter=rows.filter(x=>[x.title,x.slug,...x.outcomes].some(v=>v.toLowerCase().includes(query.toLowerCase())));
 return <section className="rounded-[22px] border border-white/10 bg-[#0c1524] p-4 sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">Independent venue / Polygon</p><h3 className="mt-2 text-xl font-semibold">Polymarket public markets</h3></div><button type="button" disabled={loading} onClick={()=>setEpoch(v=>v+1)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs"><RefreshCw className="size-4"/>Refresh</button></div>
  <p className="mt-2 text-xs text-white/55">Live catalog data from the Polymarket Gamma API, including indicative outcome prices and published liquidity/volume figures. These prices are NOT an executable CLOB depth quote; Senda has not authenticated a Polymarket trading account or enabled orders.</p>
  <label className="relative mt-4 block"><Search className="absolute left-3 top-3 size-4 text-white/35"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search sourced Polymarket listings" className="min-h-10 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-3 text-xs"/></label>
  <p className="mt-3 text-[11px] text-white/40">{loading?"Loading public feed…":reason}</p>
  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{filter.map(x=><article key={x.marketId} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
   <p className="text-sm font-semibold leading-snug">{x.title}</p>
   <div className="mt-3 grid grid-cols-2 gap-2">{x.outcomes.slice(0,2).map((name,i)=><div key={name} className="rounded-lg bg-black/15 p-2"><p className="text-xs text-white/55">{name}</p><p className="mt-1 font-mono text-base text-cyan-200">{x.indicativePrices[i]==null?"—":Math.round(x.indicativePrices[i]*100)+"%"}</p></div>)}</div>
   <p className="mt-3 font-mono text-[10px] text-white/35">Reported volume {x.volumeUsd==null?"unknown":"$"+x.volumeUsd.toLocaleString("en-US",{maximumFractionDigits:0})} · liquidity {x.liquidityUsd==null?"unknown":"$"+x.liquidityUsd.toLocaleString("en-US",{maximumFractionDigits:0})}</p>
   <button type="button" className="mt-3 min-h-10 rounded-lg border border-cyan-300/30 px-3 text-xs text-cyan-200" onClick={()=>setSelected(v=>v===x.marketId?null:x.marketId)}>{selected===x.marketId?"Hide live depth":"Inspect CLOB depth"}</button>
   {selected===x.marketId?<PolymarketDepthPreview market={x}/>:null}
   {polymarketMarketUrl(x)?<a href={polymarketMarketUrl(x)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-200">Official venue details <ExternalLink className="size-3"/></a>:null}
  </article>)}</div>
  {!loading&&!filter.length?<p className="py-8 text-center text-xs text-white/40">No sourced markets available for that search.</p>:null}
 </section>;
}
