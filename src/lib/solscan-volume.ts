/** Server-only Solscan Pro swap ingestion for Senda native volume bars.
 * Source: /v2.0/token/defi/activities, timestamped USDC-notional only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aggregateSolscanVolume, type NativeVolume } from "@/lib/solscan-volume-core.mjs";

type FeedResult={state:"ready"|"unconfigured"|"unavailable";snapshot:NativeVolume|null;reason:string;pages:number};
const TF_SECONDS={"15m":900,"1H":3600,"4H":14400,"1D":86400} as const;
const mintPattern=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PAGE_SIZE=100;
const PAGE_CAP=5; // 500 activities maximum, never claim full coverage beyond this cap.
const cache=new Map<string,{until:number;value:FeedResult}>();
const ongoing=new Map<string,Promise<FeedResult>>();
async function fetchVolume(mint:string,tf:keyof typeof TF_SECONDS):Promise<FeedResult>{
 const key=process.env.SENDA_SOLSCAN_PRO_API_KEY;
 if(!key)return {state:"unconfigured",snapshot:null,pages:0,reason:"Solscan Pro API key is not configured on the Senda server."};
 const step=TF_SECONDS[tf],end=Math.floor(Date.now()/step)*step;
 const start=Math.max(0,end-Math.min(86400,step*48));
 const events:unknown[]=[];
 let completed=false,pages=0;
 for(let page=1;page<=PAGE_CAP;page++){
  const q=new URLSearchParams({
   address:mint,from_time:String(start),to_time:String(end-1),
   page:String(page),page_size:String(PAGE_SIZE),
   sort_by:"block_time",sort_order:"desc",
  });
  q.append("activity_type[]","ACTIVITY_TOKEN_SWAP");
  q.append("activity_type[]","ACTIVITY_AGG_TOKEN_SWAP");
  const response=await fetch("https://pro-api.solscan.io/v2.0/token/defi/activities?"+q.toString(),{
   headers:{accept:"application/json",token:key},signal:AbortSignal.timeout(6500),
  });
  if(!response.ok)throw Error(response.status===429?"Solscan rate limit reached.":"Solscan upstream HTTP "+response.status);
  const data=await response.json() as {success?:boolean;data?:unknown};
  if(data.success!==true||!Array.isArray(data.data))throw Error("Solscan returned no verified swap activity page.");
  events.push(...data.data);pages=page;
  if(data.data.length<PAGE_SIZE){completed=true;break;}
 }
 const snapshot=aggregateSolscanVolume({mint,events,start,end,tf,complete:completed,
  observedAt:new Date().toISOString()});
 return {state:"ready",snapshot,pages,reason:completed?
  "Solscan API pages exhausted for the queried window; indexing may lag chain activity.":
  "Solscan request capped at 500 records: values are lower-bound samples, not total volume."};
}
export const getNativeVolume=createServerFn({method:"POST"})
 .validator((raw:unknown)=>z.object({
  mint:z.string().regex(mintPattern),tf:z.enum(["15m","1H","4H","1D"]),
 }).parse(raw))
 .handler(async({data}):Promise<FeedResult>=>{
  const key=data.mint+":"+data.tf;
  const found=cache.get(key);
  if(found&&found.until>Date.now())return found.value;
  let active=ongoing.get(key);
  if(!active){
   active=fetchVolume(data.mint,data.tf).catch(error=>({
    state:"unavailable" as const,snapshot:null,pages:0,
    reason:error instanceof Error?error.message:"Solscan indexer unavailable.",
   })).then(value=>{
    if(value.state==="ready"){
     if(cache.size>120)cache.clear();
     cache.set(key,{value,until:Date.now()+45000});
    }
    return value;
   }).finally(()=>ongoing.delete(key));
   ongoing.set(key,active);
  }
  return active;
 });
