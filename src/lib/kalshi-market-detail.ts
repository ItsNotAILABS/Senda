/** Source-backed Kalshi contract rule inspection. Public metadata only, never order entry. */
import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";

const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
export type KalshiContractDetail={
 ticker:string;title:string;status:string;eventTicker:string;rulesPrimary:string|null;
 rulesSecondary:string|null;closeTime:string|null;updatedTime:string|null;
 volume24hContracts:number|null;openInterestContracts:number|null;
 settlementSource:string;observedAt:string;isProvisional:boolean|null;
};
export type KalshiDetailResult={state:"ready"|"unavailable";detail:KalshiContractDetail|null;reason:string};
const cache=new Map<string,{expires:number,result:KalshiDetailResult}>();
const inflight=new Map<string,Promise<KalshiDetailResult>>();
const text=(x:unknown,max=1600)=>typeof x==="string"&&x.trim()?x.trim().slice(0,max):null;
const numeric=(x:unknown)=>{
 if(x===null||x===undefined||x==="")return null;
 const n=Number(x);return Number.isFinite(n)&&n>=0?n:null;
};
export const getKalshiContractDetail=createServerFn({method:"POST"})
 .validator((value:unknown)=>z.object({ticker:z.string().regex(TICKER)}).parse(value))
 .handler(async({data}):Promise<KalshiDetailResult>=>{
  const cached=cache.get(data.ticker);
  if(cached&&cached.expires>Date.now())return cached.result;
  const pending=inflight.get(data.ticker);
  if(pending)return pending;
  const task=(async():Promise<KalshiDetailResult>=>{
   try{
    const response=await fetch("https://external-api.kalshi.com/trade-api/v2/markets/"+encodeURIComponent(data.ticker),{
     headers:{accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(7000)
    });
    if(!response.ok)return {state:"unavailable",detail:null,reason:response.status===429?"Market source rate limited.":"Market rules unavailable ("+response.status+")."};
    const raw=await response.json() as {market?:Record<string,unknown>};
    const m=raw?.market;
    if(!m||m.ticker!==data.ticker)
     return {state:"unavailable",detail:null,reason:"Market response did not match requested ticker."};
    const detail:KalshiContractDetail={
     ticker:data.ticker,title:text(m.title,180)??data.ticker,
     status:text(m.status,48)??"unavailable",
     eventTicker:text(m.event_ticker,120)??"",
     rulesPrimary:text(m.rules_primary,3500),rulesSecondary:text(m.rules_secondary,2400),
     closeTime:text(m.close_time,45),updatedTime:text(m.updated_time,45),
     volume24hContracts:numeric(m.volume_24h_fp),
     openInterestContracts:numeric(m.open_interest_fp),
     settlementSource:"Kalshi public market contract metadata",
     observedAt:new Date().toISOString(),
     isProvisional:typeof m.is_provisional==="boolean"?m.is_provisional:null
    };
    return {state:"ready",detail,reason:"Contract rules originate from the public Kalshi market-detail API. They are not an execution authorization."};
   }catch{return {state:"unavailable",detail:null,reason:"Kalshi contract details could not be retrieved."};}
  })().then(result=>{
   if(cache.size>160)cache.clear();
   cache.set(data.ticker,{expires:Date.now()+(result.state==="ready"?60000:8000),result});
   return result;
  }).finally(()=>inflight.delete(data.ticker));
  inflight.set(data.ticker,task);
  return task;
 });
