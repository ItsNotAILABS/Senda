import {useEffect,useMemo,useState} from "react";
import {Activity,ChartNoAxesCombined,RefreshCw} from "lucide-react";
import {getKalshiHistory,type KalshiHistoryResult} from "@/lib/kalshi-history";
import type {KalshiHistoryBar} from "@/lib/kalshi-history-core.mjs";
import {HISTORY_WINDOWS} from "@/lib/kalshi-history-core.mjs";
import {cn} from "@/lib/utils";

type HistoryWindow="24h"|"7d"|"30d";
const fmt=(v:number)=>new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:1}).format(v);
const cents=(v:number)=>Math.round(v*10000)/100+"¢";
const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
export function KalshiHistoryChart({ticker,seriesTicker,refreshKey=0}:{ticker:string;seriesTicker?:string;refreshKey?:number}){
 const [range,setRange]=useState<HistoryWindow>("7d");
 const [result,setResult]=useState<KalshiHistoryResult|null>(null);
 const [loading,setLoading]=useState(false);
 const valid=typeof seriesTicker==="string"&&TICKER.test(seriesTicker)&&TICKER.test(ticker);
 useEffect(()=>{
  if(!valid||!seriesTicker){setResult(null);return;}
  let active=true;setLoading(true);setResult(null);
  void getKalshiHistory({data:{ticker,seriesTicker,window:range}})
   .then(x=>{if(active)setResult(x);})
   .catch(()=>{if(active)setResult({state:"unavailable",source:"Kalshi public market candlesticks",
    ticker,window:range,bars:[],observedAt:null,reason:"Kalshi candle source could not be reached."});})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[ticker,seriesTicker,valid,range,refreshKey]);
 const chart=useMemo(()=>{
  const bars=result?.bars??[];
  const withPrice=bars.filter(x=>x.priceUsd!==null);
  const volumes=bars.filter(x=>x.volumeContracts!==null).map(x=>x.volumeContracts as number);
  const minPrice=withPrice.length?Math.min(...withPrice.map(x=>x.priceUsd as number)):null;
  const maxPrice=withPrice.length?Math.max(...withPrice.map(x=>x.priceUsd as number)):null;
  const totalVol=volumes.reduce((a,b)=>a+b,0);
  const maximumVol=volumes.length?Math.max(...volumes):0;
  const start=bars[0]?.time??0,end=bars[bars.length-1]?.time??start;
  const x=(t:number)=>24+(end===start?0:(t-start)/(end-start)*792);
  const min=minPrice??0,max=maxPrice??1,pad=Math.max(.03,(max-min)*.14);
  const y=(price:number)=>170-(price-(min-pad))/(max-min+2*pad)*138;
  const segments:Array<Array<{x:number;y:number}>>=[];
  let current:Array<{x:number;y:number}>=[];
  const maxGap=(range==="30d"?86400:3600)*1.6;
  let lastTime:number|null=null;
  for(const bar of bars){
   if(bar.priceUsd===null){if(current.length)segments.push(current);current=[];lastTime=null;continue;}
   if(lastTime!==null&&bar.time-lastTime>maxGap){if(current.length)segments.push(current);current=[];}
   current.push({x:x(bar.time),y:y(bar.priceUsd)});lastTime=bar.time;
  }
  if(current.length)segments.push(current);
  const width=Math.max(2,Math.min(18,780/Math.max(1,bars.length)*.68));
  return {bars,segments,minPrice,maxPrice,totalVol,volumeKnown:volumes.length,maximumVol,x,width,
   points:bars.map(bar=>({bar,x:x(bar.time),height:bar.volumeContracts===null||maximumVol<=0?0:Math.max(1,bar.volumeContracts/maximumVol*44)}))};
 },[result,range]);
 return <section className="rounded-2xl border border-white/10 bg-[#0b1827] p-4">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><p className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-cyan-300"><ChartNoAxesCombined className="size-3.5"/>PUBLIC PRICE & VOLUME HISTORY</p>
    <p className="mt-1 text-[11px] text-white/45">Actual Kalshi candle closes and reported contracts traded</p></div>
   <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1">
    {HISTORY_WINDOWS.map(w=><button type="button" key={w.id} onClick={()=>setRange(w.id)} aria-pressed={range===w.id}
      className={cn("min-h-8 rounded-lg px-2.5 font-mono text-[10px]",range===w.id?"bg-cyan-300 text-[#071622]":"text-white/50 hover:bg-white/10")}>{w.name}</button>)}
   </div>
  </div>
  {!valid?<p className="mt-4 rounded-xl border border-amber-300/15 p-4 text-xs text-amber-200">This market did not supply a verified series ticker; historical bars are unavailable.</p>:
   loading?<div className="mt-4 flex min-h-[190px] items-center justify-center gap-2 text-xs text-white/45"><RefreshCw className="size-4 animate-spin"/>Reading Kalshi candles…</div>:
   result?.state==="ready"&&chart.bars.length?<>
    <div className="mt-3 grid grid-cols-3 gap-2">
     <div><p className="text-[10px] text-white/40">Low observed close</p><p className="mt-1 font-mono text-[13px]">{chart.minPrice===null?"—":cents(chart.minPrice)}</p></div>
     <div><p className="text-[10px] text-white/40">High observed close</p><p className="mt-1 font-mono text-[13px]">{chart.maxPrice===null?"—":cents(chart.maxPrice)}</p></div>
     <div><p className="text-[10px] text-white/40">Reported contracts / sampled</p><p className="mt-1 font-mono text-[13px]">{chart.volumeKnown?fmt(chart.totalVol):"—"}</p></div>
    </div>
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[.075] bg-[#07111e]">
     <svg viewBox="0 0 840 260" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Sourced Kalshi historical close prices and true reported trade-volume bars">
      {[48,106,164].map(y=><line key={y} x1="24" x2="816" y1={y} y2={y} stroke="#5e7a98" strokeOpacity=".12" strokeDasharray="3 5"/>)}
      <line x1="24" x2="816" y1="190" y2="190" stroke="#5e7a98" strokeOpacity=".2"/>
      {chart.points.map(({bar,x,height})=>bar.volumeContracts===null?null:<rect key={bar.time} x={x-chart.width/2} y={242-height} width={chart.width} height={height} rx="1.5" fill="#5fe3d4" opacity=".48"/>)}
      {chart.segments.map((segment,i)=>segment.length<2?segment.map((p,j)=><circle key={i+"-"+j} cx={p.x} cy={p.y} r="2.6" fill="#82ebff"/>):
       <polyline key={i} points={segment.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="#82ebff" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round"/>)}
      <text x="27" y="24" fill="#7499b3" fontSize="11">YES close price</text>
      <text x="27" y="207" fill="#7499b3" fontSize="11">24h / interval volume</text>
     </svg>
    </div>
    <p className="mt-2 text-[10px] leading-5 text-white/35">Volume bars are exactly sourced period observations; missing periods/prices are left blank, not interpolated. A zero volume bar is only zero when the source explicitly reports zero. History is not a quote.</p>
   </>:<div className="mt-4 flex min-h-[185px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
    <Activity className="size-6 text-white/20"/><p className="mt-3 text-xs text-white/65">No verified Kalshi candles for this range</p><p className="mt-2 text-[11px] leading-5 text-white/40">{result?.reason||"Choose a history range when the source is available."}</p>
   </div>}
  <p className="mt-2 font-mono text-[10px] text-white/35">Source: Kalshi public market candlesticks · {result?.observedAt?new Date(result.observedAt).toLocaleTimeString():"No verified timestamp"} · no simulated volume</p>
 </section>;
}
