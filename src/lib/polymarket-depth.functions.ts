import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {normalizePolymarketDepth,type PolymarketBook} from "@/lib/polymarket-depth.mjs";
const TOKEN=/^[0-9]{20,100}$/;
const cache=new Map<string,{expires:number,book:PolymarketBook}>();
const active=new Map<string,Promise<{ready:boolean;book:PolymarketBook|null;reason:string}>>();
type Result={ready:boolean;book:PolymarketBook|null;reason:string};
export const getPolymarketPublicDepth=createServerFn({method:"POST"})
 .validator((raw:unknown)=>z.object({tokenId:z.string().regex(TOKEN)}).parse(raw))
 .handler(async({data}):Promise<Result>=>{
  const c=cache.get(data.tokenId);
  if(c&&c.expires>Date.now())return {ready:true,book:c.book,reason:"Public Polymarket CLOB book; not executable authorization."};
  const pending=active.get(data.tokenId);if(pending)return pending;
  const task=(async():Promise<Result>=>{
   try{
    const url="https://clob.polymarket.com/book?token_id="+encodeURIComponent(data.tokenId);
    const resp=await fetch(url,{headers:{accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(6500)});
    if(!resp.ok)return {ready:false,book:null,reason:"Polymarket public CLOB depth unavailable ("+resp.status+")."};
    const book=normalizePolymarketDepth(data.tokenId,await resp.json(),Date.now());
    if(cache.size>80)cache.clear();cache.set(data.tokenId,{book,expires:Date.now()+8000});
    return {ready:true,book,reason:"Observed CLOB bids/asks; not an authenticated order quote."};
   }catch{return {ready:false,book:null,reason:"CLOB book unavailable or token mapping failed."};}
  })().finally(()=>active.delete(data.tokenId));
  active.set(data.tokenId,task);return task;
 });
