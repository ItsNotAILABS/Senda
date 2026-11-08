/** Server-only Liquify V2 pass-through. No browser origin/token exposure or signing. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const mint = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const amount = z.string().regex(/^[1-9][0-9]{0,19}$/);
const inputSchema = z.object({
 inputMint: mint, outputMint: mint, amount
}).refine(v=>v.inputMint!==v.outputMint,"Mints must differ");
export type LiquifyV2Route={
 venue:string;inputMint:string;outputMint:string;inAmount:string;outAmount:string;
 observedAt:string;cacheAgeMs:number;router:string;priceSource:string;state:"indicative-quote";
};
export type LiquifyV2Comparison={
 schema:"senda.liquify.compare.v2";inputMint:string;outputMint:string;amount:string;
 routes:LiquifyV2Route[];rejected:string[];best?:LiquifyV2Route;
 observedAt:string;executionEnabled:false;note:string;
};
export const compareLiquifyRoutes=createServerFn({method:"POST"})
 .validator((input:unknown)=>inputSchema.parse(input))
 .handler(async({data}):Promise<LiquifyV2Comparison>=>{
  const base=process.env.SENDA_LIQUIFY_ORIGIN;
  const token=process.env.SENDA_ROUTER_INTERNAL_KEY;
  if(!base||!token)throw Error("Private Liquify V2 service not configured");
  const origin=new URL(base);
  if((origin.protocol!=="https:" && !(
   origin.protocol==="http:" && ["127.0.0.1","localhost","::1"].includes(origin.hostname)
  ))||origin.username||origin.password||origin.search||origin.hash)
   throw Error("Unsafe Liquify service origin");
  const endpoint=new URL("/v2/compare",origin);
  endpoint.search=new URLSearchParams(data).toString();
  const response=await fetch(endpoint,{headers:{"accept":"application/json","X-Senda-Router-Key":token},
   signal:AbortSignal.timeout(12000),redirect:"error"});
  if(!response.ok)throw Error("No verified comparative liquidity available");
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=="object")throw Error("Invalid Liquify V2 response");
  const r=raw as Record<string,unknown>;
  if(r.schema!=="senda.liquify.compare.v2"||r.executionEnabled!==false||
    r.inputMint!==data.inputMint||r.outputMint!==data.outputMint||
    r.amount!==data.amount||!Array.isArray(r.routes)||!Array.isArray(r.rejected))
   throw Error("Liquify V2 contract mismatch");
  const validated:LiquifyV2Route[]=r.routes.map((x:unknown)=>{
   const row=x as Partial<LiquifyV2Route>;
   if(!row||typeof row!=="object"||typeof row.venue!=="string"||
    row.inputMint!==data.inputMint||row.outputMint!==data.outputMint||row.inAmount!==data.amount||
    typeof row.outAmount!=="string"||!amount.safeParse(row.outAmount).success||
    row.state!=="indicative-quote"||typeof row.observedAt!=="string"||
    !Number.isFinite(Date.parse(row.observedAt))||
    typeof row.cacheAgeMs!=="number"||row.cacheAgeMs<0||row.cacheAgeMs>3000||
    typeof row.router!=="string"||typeof row.priceSource!=="string")
    throw Error("Invalid Liquify venue observation");
   return row as LiquifyV2Route;
  });
  return {schema:"senda.liquify.compare.v2",
   inputMint:data.inputMint,outputMint:data.outputMint,amount:data.amount,
   routes:validated,rejected:r.rejected.filter((x):x is string=>typeof x==="string").slice(0,16),
   ...(validated[0]?{best:validated[0]}:{}),
   observedAt:typeof r.observedAt==="string"?r.observedAt:new Date().toISOString(),
   executionEnabled:false,
   note:"Indicative quotes only; not an executable venue order or guaranteed exit."
  };
 });
