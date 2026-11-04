import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {normalizePolymarketCatalog,type PolymarketCatalogRow} from "@/lib/polymarket-catalog.mjs";
let cached:{until:number;rows:PolymarketCatalogRow[]}|null=null;
let pending:Promise<PolymarketCatalogRow[]>|null=null;
export const getPolymarketPublicMarkets=createServerFn({method:"POST"})
 .validator((raw:unknown)=>z.object({limit:z.number().int().min(1).max(40).default(30)}).parse(raw))
 .handler(async({data})=>{
  if(!cached||cached.until<Date.now()){
   if(!pending)pending=(async()=>{
    const q=new URLSearchParams({active:"true",closed:"false",limit:"40",offset:"0",order:"volume",ascending:"false"});
    const response=await fetch("https://gamma-api.polymarket.com/markets?"+q.toString(),{
     headers:{accept:"application/json"},signal:AbortSignal.timeout(7000),redirect:"error"
    });
    if(!response.ok)throw Error("Polymarket public catalog unavailable: "+response.status);
    const rows=normalizePolymarketCatalog(await response.json(),Date.now());
    cached={rows,until:Date.now()+45000};return rows;
   })().finally(()=>{pending=null;});
   try{await pending;}catch{return {state:"unavailable" as const,rows:[],note:"Public Gamma feed unavailable; no prices were invented."};}
  }
  return {state:"ready" as const,rows:cached?.rows.slice(0,data.limit)||[],note:"Indicative public Gamma catalog — not executable orderbook quotes."};
 });
