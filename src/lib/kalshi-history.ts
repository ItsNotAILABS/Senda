/** Public Kalshi history reader. Prices and volumes originate in documented venue candles. */
import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {HISTORY_WINDOWS,normalizeKalshiCandles,type KalshiHistoryBar} from "@/lib/kalshi-history-core.mjs";

const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
export type KalshiHistoryResult={
 state:"ready"|"unavailable";source:string;ticker:string;window:"24h"|"7d"|"30d";
 bars:KalshiHistoryBar[];observedAt:string|null;reason:string;
};
const schema=z.object({ticker:z.string().regex(TICKER),seriesTicker:z.string().regex(TICKER),
 window:z.enum(["24h","7d","30d"])});
const cache=new Map<string,{expires:number,result:KalshiHistoryResult}>();
const inflight=new Map<string,Promise<KalshiHistoryResult>>();
export const getKalshiHistory=createServerFn({method:"POST"})
 .validator((input:unknown)=>schema.parse(input))
 .handler(async({data}):Promise<KalshiHistoryResult>=>{
  const key=data.seriesTicker+"|"+data.ticker+"|"+data.window;
  const cached=cache.get(key);
  if(cached&&cached.expires>Date.now())return cached.result;
  const pending=inflight.get(key);if(pending)return pending;
  const work=(async():Promise<KalshiHistoryResult>=>{
   const base={source:"Kalshi public market candlesticks",ticker:data.ticker,window:data.window};
   try{
    const spec=HISTORY_WINDOWS.find(x=>x.id===data.window);
    if(!spec)throw Error("Unsupported Kalshi interval");
    const end=Math.floor(Date.now()/1000),start=end-spec.days*86400;
    const url=new URL("https://external-api.kalshi.com/trade-api/v2/series/"+
     encodeURIComponent(data.seriesTicker)+"/markets/"+encodeURIComponent(data.ticker)+"/candlesticks");
    url.searchParams.set("start_ts",String(start));
    url.searchParams.set("end_ts",String(end));
    url.searchParams.set("period_interval",String(spec.interval));
    const response=await fetch(url,{headers:{accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(7500)});
    if(!response.ok)return {...base,state:"unavailable",bars:[],observedAt:null,
     reason:response.status===429?"Kalshi history rate limited.":"Kalshi history unavailable ("+response.status+")."};
    const raw=await response.json() as {ticker?:unknown;candlesticks?:unknown};
    if(raw?.ticker!==data.ticker||!Array.isArray(raw?.candlesticks))
     throw Error("Mismatched Kalshi history response");
    const bars=normalizeKalshiCandles(raw.candlesticks,{from:start,to:end});
    return {...base,state:bars.length?"ready":"unavailable",bars,observedAt:new Date().toISOString(),
     reason:bars.length?"Sourced price and contract volume candles; missing observations remain blank.":"No sourced trade candles were returned for this interval."};
   }catch{return {...base,state:"unavailable",bars:[],observedAt:null,reason:"Kalshi candle source could not be verified."};}
  })().then(result=>{
   if(cache.size>130)cache.clear();
   cache.set(key,{expires:Date.now()+(result.state==="ready"?45000:10000),result});
   return result;
  }).finally(()=>inflight.delete(key));
  inflight.set(key,work);
  return work;
 });
