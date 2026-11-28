/** Senda server-only Jupiter quote ladder: real indicative venue outputs, not an order book. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { quoteFromJupiter } from "@/lib/liquify-math.mjs";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIZES=[5,25,100,250] as const;
type Row={usd:number;status:"available"|"unavailable";quote?:{
 inAmount:string;outAmount:string;router:string;mode:string;feeBps:number|null;impactPct?:number|null;observedAt:string;
 };reason?:string};
export type LiquifyResult={mint:string;pair:string;kind:string;observedAt:string;sizes:Row[];note:string;source:string};
const mintPattern=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const waiting=new Map<string,Promise<LiquifyResult>>();
const cached=new Map<string,{expires:number;data:LiquifyResult}>();
const QUOTE_URLS=[
 (qs:string)=>`https://lite-api.jup.ag/swap/v1/quote?${qs}`,
 (qs:string)=>`https://public.jupiterapi.com/quote?${qs}`,
];
function loopbackOrigin(origin:string):URL|null{
 try{
  const root=new URL(origin);
  const loop=["localhost","127.0.0.1","::1"].includes(root.hostname);
  if(root.protocol!=="https:"&&!(root.protocol==="http:"&&loop))return null;
  if(root.username||root.password||root.search||root.hash)return null;
  return root;
 }catch{return null;}
}
async function directQuote(mint:string,usd:number):Promise<Row>{
 const amount=String(usd*1_000_000);
 const qs=`inputMint=${USDC}&outputMint=${mint}&amount=${amount}&slippageBps=100`;
 let reason="No verified provider response.";
 for(const url of QUOTE_URLS){
  try{
   const resp=await fetch(url(qs),{headers:{accept:"application/json"},signal:AbortSignal.timeout(8000)});
   if(resp.status===429){reason="Jupiter is busy. Wait a moment.";continue;}
   if(!resp.ok){reason="Jupiter unavailable ("+resp.status+").";continue;}
   const quote=quoteFromJupiter(await resp.json() as unknown,amount,{outputMint:mint,inputMint:USDC});
   if(quote)return {usd,status:"available",quote};
   reason="The router did not provide a valid positive quote.";
  }catch{reason="No verified provider response.";}
 }
 return {usd,status:"unavailable",reason};
}
async function fromGo(mint:string,root:URL):Promise<LiquifyResult>{
 const resp=await fetch(new URL("/v1/ladder?mint="+encodeURIComponent(mint),root),{
  headers:{accept:"application/json",...(process.env.SENDA_ROUTER_INTERNAL_KEY?{"X-Senda-Router-Key":process.env.SENDA_ROUTER_INTERNAL_KEY}:{})},
  signal:AbortSignal.timeout(18000),
 });
 if(!resp.ok)throw new Error("Go Liquify router unavailable ("+resp.status+").");
 const raw=await resp.json() as {sizes?:Array<{usd?:number;status?:string;quote?:unknown;reason?:string}>};
 if(!Array.isArray(raw.sizes))throw new Error("Go Liquify returned no quote-size curve.");
 const sizes:Row[]=SIZES.map(usd=>{
  const row=raw.sizes?.find(item=>item.usd===usd);
  const quote=row?.status==="available"?quoteFromJupiter(row.quote,String(usd*1_000_000),{outputMint:mint,inputMint:USDC}):null;
  return quote?{usd,status:"available" as const,quote}:{usd,status:"unavailable" as const,reason:row?.reason||"No independently verified route."};
 });
 return {mint,pair:"USDC/token",kind:"quote-size-curve",observedAt:new Date().toISOString(),sizes,
  source:"Senda Go Liquify → Jupiter",note:"Quote-only size curve, not resting orders. Not guaranteed inventory, settlement or an executable taker-bound trade."};
}
async function build(mint:string):Promise<LiquifyResult>{
 const configured=process.env.SENDA_LIQUIFY_ORIGIN;
 const root=configured?loopbackOrigin(configured):null;
 if(root){
  try{
   const go=await fromGo(mint,root);
   if(go.sizes.some(row=>row.status==="available"))return go;
  }catch{/* The desk quotes Jupiter when the Go router does not verify a size. */}
 }
 const sizes=await Promise.all(SIZES.map(size=>directQuote(mint,size)));
 return {mint,pair:"USDC/token",kind:"quote-size-curve",observedAt:new Date().toISOString(),sizes,
  source:configured?"Jupiter quote. The Go router did not verify a size.":"Jupiter quote",
  note:"Indicative quotes at four sizes. Not bids, not a fill, and not a promise the size is still there."};
}
export const getLiquifyLadder=createServerFn({method:"POST"})
 .validator((input:unknown)=>z.object({mint:z.string().regex(mintPattern).refine(x=>x!==USDC)}).parse(input))
 .handler(async({data}):Promise<LiquifyResult>=>{
  const hit=cached.get(data.mint);
  if(hit&&hit.expires>Date.now())return hit.data;
  let current=waiting.get(data.mint);
  if(!current){
   current=build(data.mint).then(result=>{
    // Only a successful provider observation may enter a short cache.
    if(result.sizes.some(x=>x.status==="available"))cached.set(data.mint,{expires:Date.now()+12000,data:result});
    return result;
   }).finally(()=>waiting.delete(data.mint));
   waiting.set(data.mint,current);
  }
  return current;
 });

/** Read the token's actual decimals from the mint account. Never assume nine decimals. */
export const getLiquifyDecimals=createServerFn({method:"POST"})
 .validator((input:unknown)=>z.object({mint:z.string().regex(mintPattern)}).parse(input))
 .handler(async({data}):Promise<number|null>=>{
  try{
   const rpc=process.env.SENDA_SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com";
   const response=await fetch(rpc,{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",
       params:[data.mint,{encoding:"jsonParsed",commitment:"confirmed"}]}),
     signal:AbortSignal.timeout(6500),
   });
   if(!response.ok)return null;
   const json=await response.json() as {result?:{value?:{data?:{parsed?:{type?:string;info?:{decimals?:unknown}}}}}};
   const parsed=json.result?.value?.data?.parsed;
   const n=parsed?.type==="mint"?parsed.info?.decimals:null;
   return typeof n==="number"&&Number.isInteger(n)&&n>=0&&n<=18?n:null;
  }catch{return null;}
 });
