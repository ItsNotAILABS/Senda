/** Public Kalshi orderbook fetch. No user keys, no venue order placement or wallet claims. */
import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {normalizeEventBook,type EventBook} from "@/lib/event-contract-router.mjs";
const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const cache=new Map<string,{expires:number,book:EventBook}>();
const pending=new Map<string,Promise<{state:"ready"|"unavailable";book:EventBook|null;reason:string}>>();
type Result={state:"ready"|"unavailable";book:EventBook|null;reason:string};
export const getKalshiDepth=createServerFn({method:"POST"})
 .validator((value:unknown)=>z.object({ticker:z.string().regex(TICKER)}).parse(value))
 .handler(async({data}):Promise<Result>=>{
  const cached=cache.get(data.ticker);
  if(cached&&cached.expires>Date.now())return {state:"ready",book:cached.book,reason:"Public Kalshi book; prices may move."};
  const existing=pending.get(data.ticker);
  if(existing)return existing;
  const task=(async():Promise<Result>=>{
   try{
    const endpoint="https://external-api.kalshi.com/trade-api/v2/markets/"+encodeURIComponent(data.ticker)+"/orderbook?depth=20";
    const response=await fetch(endpoint,{headers:{accept:"application/json"},signal:AbortSignal.timeout(6500)});
    if(!response.ok)return {state:"unavailable",book:null,reason:response.status===429?"Kalshi depth rate limited.":"Public market depth unavailable ("+response.status+")."};
    const raw=await response.json() as unknown;
    const book=normalizeEventBook(data.ticker,raw,Date.now());
    if(!book.yesBids.length&&!book.noBids.length)
      return {state:"unavailable",book,reason:"No sourced opposing orders; no executable estimate."};
    if(cache.size>100)cache.clear();
    cache.set(data.ticker,{expires:Date.now()+8000,book});
    return {state:"ready",book,reason:"Sourced public Kalshi orderbook. Not an authenticated quote or order."};
   }catch{return {state:"unavailable",book:null,reason:"Kalshi orderbook network request failed."};}
  })().finally(()=>pending.delete(data.ticker));
  pending.set(data.ticker,task);
  return task;
 });
