import {useEffect,useState} from "react";
import {ExternalLink,RefreshCw,Search} from "lucide-react";
import {getPolymarketPublicMarkets} from "@/lib/polymarket-catalog";
import {polymarketMarketUrl,type PolymarketCatalogRow} from "@/lib/polymarket-catalog.mjs";
export function PolymarketPublicDiscovery(){
 const [rows,setRows]=useState<PolymarketCatalogRow[]>([]);
 const [loading,setLoading]=useState(false);
 const [reason,setReason]=useState("");
 const [query,setQuery]=useState("");
 const [epoch,setEpoch]=useState(0);
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
   {polymarketMarketUrl(x)?<a href={polymarketMarketUrl(x)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-200">Official venue details <ExternalLink className="size-3"/></a>:null}
  </article>)}</div>
  {!loading&&!filter.length?<p className="py-8 text-center text-xs text-white/40">No sourced markets available for that search.</p>:null}
 </section>;
}
