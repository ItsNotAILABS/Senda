import {normalizeEventBook,planEventSide} from "./event-contract-router.mjs";
import {selectMarkets} from "./event-market-discovery.mjs";
import {normalizeKalshiCandles,HISTORY_WINDOWS} from "./kalshi-history-core.mjs";

export const KALSHI_ORIGIN="https://external-api.kalshi.com";
const tickerPattern=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const str=(x,n=200)=>typeof x==="string"?x.trim().slice(0,n):"";
function number(x){
 if(x===null||x===undefined||x==="")return null;
 const n=Number(x);return Number.isFinite(n)&&n>=0?n:null;
}
export function requireTicker(value){
 if(typeof value!=="string"||!tickerPattern.test(value))throw Object.assign(new Error("Valid Kalshi ticker required"),{status:400,code:"INVALID_TICKER"});
 return value;
}
function upstreamError(status){
 const code=status===429?"PROVIDER_RATE_LIMITED":"PROVIDER_UNAVAILABLE";
 return Object.assign(new Error("Kalshi public source unavailable."),{status:503,code});
}
export function createKalshiProvider({fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 async function raw(path,ttl=10000){
  const cached=cache.get(path),time=now();
  if(cached&&cached.expiry>time)return cached.value;
  if(pending.has(path))return pending.get(path);
  const task=(async()=>{
   const url=new URL(path,KALSHI_ORIGIN);
   if(url.origin!==KALSHI_ORIGIN)throw Object.assign(new Error("Forbidden source"),{status:400,code:"UNSUPPORTED_SOURCE"});
   const response=await fetchImpl(url.toString(),{headers:{accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(6500)});
   if(!response.ok)throw upstreamError(response.status);
   const size=Number(response.headers?.get?.("content-length")??0);
   if(size>1_000_000)throw upstreamError(502);
   const body=await response.text();
   if(body.length>1_000_000)throw upstreamError(502);
   let parsed;try{parsed=JSON.parse(body)}catch{throw upstreamError(502)}
   if(cache.size>200)cache.clear();
   cache.set(path,{expiry:now()+ttl,value:parsed});
   return parsed;
  })().finally(()=>pending.delete(path));
  pending.set(path,task);return task;
 }
 async function markets({query="",lane="all",sort="activity",limit=30,cursor=""}={}){
  const url=new URL("/trade-api/v2/events",KALSHI_ORIGIN);
  url.searchParams.set("limit","100");
  url.searchParams.set("status","open");
  url.searchParams.set("with_nested_markets","true");
  if(cursor)url.searchParams.set("cursor",cursor);
  const payload=await raw(url.pathname+url.search,20000);
  if(!Array.isArray(payload?.events))throw upstreamError(502);
  const list=[];
  for(const event of payload.events.slice(0,100)){
   if(!event||typeof event!=="object"||!Array.isArray(event.markets))continue;
   for(const market of event.markets.slice(0,200)){
    if(!market||!tickerPattern.test(market.ticker??""))continue;
    list.push({ticker:market.ticker,eventTicker:str(event.event_ticker,120),
     seriesTicker:str(event.series_ticker,120),title:str(event.title,200)||str(market.title,200)||market.ticker,
     yes:str(market.yes_sub_title,200),category:str(event.category,90)||"Other",
     bid:number(market.yes_bid_dollars),ask:number(market.yes_ask_dollars),
     volume24hContracts:number(market.volume_24h_fp),
     closeTime:str(market.close_time,50),source:"Kalshi public events"});
   }
  }
  const filtered=selectMarkets(list.map(x=>({...x,vol:x.volume24hContracts??0,close:x.closeTime})),{q:query,lane,sort});
  return {markets:filtered.slice(0,limit).map(({vol,close,...m})=>m),
   nextCursor:typeof payload.cursor==="string"&&payload.cursor.length<=512?payload.cursor:null,
   pageScope:"single Kalshi events page",observedAt:new Date(now()).toISOString(),
   limitation:"Topic filters apply to this fetched provider page only; cursor paging is required for broader discovery."};
 }
 async function detail(ticker){
  requireTicker(ticker);
  const result=await raw("/trade-api/v2/markets/"+encodeURIComponent(ticker),30000);
  const m=result?.market;
  if(!m||m.ticker!==ticker)throw Object.assign(new Error("Market not found in verified response"),{status:404,code:"MARKET_NOT_FOUND"});
  return {ticker,title:str(m.title,200),status:str(m.status,50),eventTicker:str(m.event_ticker,120),
   seriesTicker:str(m.series_ticker,120),rulesPrimary:str(m.rules_primary,4000)||null,
   rulesSecondary:str(m.rules_secondary,3000)||null,closeTime:str(m.close_time,60)||null,
   volume24hContracts:number(m.volume_24h_fp),openInterestContracts:number(m.open_interest_fp),
   source:"Kalshi public market detail",observedAt:new Date(now()).toISOString()};
 }
 async function book(ticker){
  requireTicker(ticker);
  const at=now();
  const result=await raw("/trade-api/v2/markets/"+encodeURIComponent(ticker)+"/orderbook?depth=20",4000);
  return normalizeEventBook(ticker,result,at);
 }
 async function history(ticker,window="7d"){
  requireTicker(ticker);
  const spec=HISTORY_WINDOWS.find(x=>x.id===window);
  if(!spec)throw Object.assign(new Error("Unsupported timeframe"),{status:400,code:"INVALID_TIMEFRAME"});
  const d=await detail(ticker);
  requireTicker(d.seriesTicker);
  const end=Math.floor(now()/1000),start=end-spec.days*86400;
  const u=new URL("/trade-api/v2/series/"+encodeURIComponent(d.seriesTicker)+"/markets/"+encodeURIComponent(ticker)+"/candlesticks",KALSHI_ORIGIN);
  for(const [key,value] of Object.entries({start_ts:String(start),end_ts:String(end),period_interval:String(spec.interval)}))u.searchParams.set(key,value);
  const result=await raw(u.pathname+u.search,30000);
  if(result?.ticker&&result.ticker!==ticker)throw upstreamError(502);
  if(!Array.isArray(result?.candlesticks))throw upstreamError(502);
  return {ticker,seriesTicker:d.seriesTicker,window,source:"Kalshi public market candlesticks",
   observedAt:new Date(now()).toISOString(),bars:normalizeKalshiCandles(result.candlesticks,{from:start,to:end})};
 }
 return {markets,detail,book,history,planEventSide};
}
