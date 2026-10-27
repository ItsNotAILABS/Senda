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
async function fromGoVolume(mint:string,tf:keyof typeof TF_SECONDS):Promise<FeedResult|null>{
 const configured=process.env.SENDA_LIQUIFY_ORIGIN;
 if(!configured)return null;
 const origin=new URL(configured);
 const loopback=["localhost","127.0.0.1","::1"].includes(origin.hostname);
 if(origin.protocol!=="https:"&&!(origin.protocol==="http:"&&loopback))throw Error("Liquify origin must be HTTPS or loopback.");
 if(origin.username||origin.password||origin.search||origin.hash)throw Error("Invalid Liquify origin.");
 const url=new URL("/v1/volume",origin);
 url.searchParams.set("mint",mint);url.searchParams.set("tf",tf);
 const resp=await fetch(url,{
  headers:{accept:"application/json",...(process.env.SENDA_ROUTER_INTERNAL_KEY?{"X-Senda-Router-Key":process.env.SENDA_ROUTER_INTERNAL_KEY}:{})},
  signal:AbortSignal.timeout(22000),
 });
 if(!resp.ok)throw Error("Go Liquify Solscan index unavailable ("+resp.status+").");
 const value=await resp.json() as FeedResult;
 if(value?.state!=="ready"||value.snapshot?.schema!=="senda.volume.solscan.v1"||
    value.snapshot?.mint!==mint||value.snapshot?.interval!==tf||
    !Array.isArray(value.snapshot?.bars)||value.snapshot.bars.length>120)
    throw Error("Go Liquify returned invalid or mismatched volume output.");
 return value;
}
async function fetchVolume(mint:string,tf:keyof typeof TF_SECONDS):Promise<FeedResult>{
 try {const go=await fromGoVolume(mint,tf);if(go)return go;}
 catch(error){if(!process.env.SENDA_SOLSCAN_PRO_API_KEY)throw error;}
 const key=process.env.SENDA_SOLSCAN_PRO_API_KEY;
 if(!key)return {state:"unconfigured",snapshot:null,pages:0,reason:"Solscan Pro API key is not configured on the Senda server."};
 const step=TF_SECONDS[tf],now=Math.floor(Date.now()/1000);
 const end=(Math.floor(now/step)+1)*step;
 const start=Math.max(0,end-Math.min(86400,step*48));
 const events:unknown[]=[];
 let completed=false,pages=0;
 for(let page=1;page<=PAGE_CAP;page++){
  const q=new URLSearchParams({
   address:mint,from_time:String(start),to_time:String(now),
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
  observedAt:new Date().toISOString(),observedThrough:now});
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
