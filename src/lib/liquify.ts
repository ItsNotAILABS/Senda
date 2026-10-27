/** Senda server-only Jupiter V2 quote ladder: real indicative venue outputs, not an order book. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIZES=[5,25,100,250] as const;
type Row={usd:number;status:"available"|"unavailable";quote?:{
 inAmount:string;outAmount:string;router:string;mode:string;feeBps:number|null;observedAt:string;
 };reason?:string};
export type LiquifyResult={mint:string;pair:string;kind:string;observedAt:string;sizes:Row[];note:string;source:string};
const mintPattern=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const amountPattern=/^[1-9][0-9]{0,19}$/;
const limiter={nextAt:0,tail:Promise.resolve()};
const waiting=new Map<string,Promise<LiquifyResult>>();
const cached=new Map<string,{expires:number;data:LiquifyResult}>();
async function paceKeyless(){
 const pending=limiter.tail.then(async()=>{
   const ms=Math.max(0,limiter.nextAt-Date.now());
   if(ms)await new Promise<void>(resolve=>setTimeout(resolve,ms));
   limiter.nextAt=Date.now()+2100;
 });
 limiter.tail=pending.catch(()=>undefined);
 await pending;
}
function safeQuote(raw:unknown,amount:string):Row["quote"]|null{
 if(!raw||typeof raw!=="object")return null;
 const data=raw as Record<string,unknown>;
 const rawInput=data.inAmount,rawOutput=data.outAmount;
 if(!amountPattern.test(String(rawInput))||String(rawInput)!==amount)return null;
 if(typeof rawOutput!=="string"||!amountPattern.test(rawOutput))return null;
 if(typeof data.router!=="string"||data.router.trim().length===0)return null;
 if(data.errorCode!=null||data.errorMessage!=null)return null;
 const fee=Number(data.feeBps);
 return {inAmount:amount,outAmount:rawOutput,router:data.router.slice(0,60),
   mode:typeof data.mode==="string"?data.mode.slice(0,30):"unknown",
   feeBps:data.feeBps!=null&&Number.isFinite(fee)&&fee>=0&&fee<=10000?fee:null,
   observedAt:new Date().toISOString()};
}
async function directQuote(mint:string,usd:number):Promise<Row>{
 const amount=String(usd*1_000_000);
 try{
  if(!process.env.SENDA_JUPITER_API_KEY)await paceKeyless();
  const params=new URLSearchParams({inputMint:USDC,outputMint:mint,amount});
  const resp=await fetch("https://api.jup.ag/swap/v2/order?"+params,{
    headers:{accept:"application/json",...(process.env.SENDA_JUPITER_API_KEY?{"x-api-key":process.env.SENDA_JUPITER_API_KEY}:{})},
    signal:AbortSignal.timeout(7500),
  });
  if(!resp.ok)return {usd,status:"unavailable",reason:resp.status===429?"Jupiter rate limited the request.":"Jupiter unavailable ("+resp.status+")."};
  const raw=await resp.json() as unknown;
  const quote=safeQuote(raw,amount);
  return quote?{usd,status:"available",quote}:{usd,status:"unavailable",reason:"The router did not provide a valid positive quote."};
 }catch{return {usd,status:"unavailable",reason:"No verified provider response."};}
}
async function fromGo(mint:string):Promise<LiquifyResult|null>{
 const origin=process.env.SENDA_LIQUIFY_ORIGIN;
 if(!origin)return null;
 const root=new URL(origin);
 if(!["http:","https:"].includes(root.protocol)||root.username||root.password||root.search||root.hash)
  throw new Error("Invalid server-configured Liquify origin.");
 const resp=await fetch(new URL("/v1/ladder?mint="+mint,root),{
  headers:{accept:"application/json",...(process.env.SENDA_ROUTER_INTERNAL_KEY?{"X-Senda-Router-Key":process.env.SENDA_ROUTER_INTERNAL_KEY}:{})},
  signal:AbortSignal.timeout(18000),
 });
 if(!resp.ok)throw new Error("Go Liquify router unavailable ("+resp.status+").");
 const raw=await resp.json() as {sizes?:Array<{usd?:number;status?:string;quote?:Record<string,unknown>;reason?:string}>;observedAt?:string};
 if(!Array.isArray(raw.sizes))throw new Error("Go Liquify returned no quote-size curve.");
 const sizes:Row[]=SIZES.map(usd=>{
  const row=raw.sizes?.find(r=>r.usd===usd);
  const quote=row?.status==="available"?safeQuote(row.quote,String(usd*1000000)):null;
  return quote?{usd,status:"available",quote}:{usd,status:"unavailable",reason:row?.reason||"No independently verified route."};
 });
 return {mint,pair:"USDC/token",kind:"quote-size-curve",observedAt:new Date().toISOString(),sizes,
  source:"Senda Go Liquify → Jupiter V2",note:"Quote-only size curve, not resting orders. Not guaranteed inventory, settlement or an executable taker-bound trade."};
}
async function build(mint:string):Promise<LiquifyResult>{
 const go=await fromGo(mint).catch(()=>null);
 if(go)return go;
 const sizes=await Promise.all(SIZES.map(s=>directQuote(mint,s)));
 return {mint,pair:"USDC/token",kind:"quote-size-curve",observedAt:new Date().toISOString(),sizes,
 source:"Jupiter V2 quote-only (server fallback)",note:"Indicative quote-only observations, not bids/asks or settled trades. No Go service is assumed to be connected."};
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
