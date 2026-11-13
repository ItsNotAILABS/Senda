/** Live Jupiter quotes. Senda is agent — we do not warehouse the other side. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Official Jupiter gateway; the legacy Lite hostname retires October 30, 2026.
const QUOTE_URLS = [(qs: string) => `https://api.jup.ag/swap/v1/quote?${qs}`];

export type JupQuote = {
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  route: string[];
  swapUsdValue: string | null;
  inMint: string;
  outMint: string;
  side: "buy" | "sell";
  /** Required for true mint-denominated sell previews. */
  inputDecimals?: number;
};

function routeLabels(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const plan = (raw as { routePlan?: Array<{ swapInfo?: { label?: string } }> }).routePlan;
  if (!Array.isArray(plan)) return [];
  return plan.map((p) => p.swapInfo?.label || "DEX").filter(Boolean);
}

const rawDigits = /^[1-9][0-9]{0,19}$/;
const decimalsCache = new Map<string,{value:number;expires:number}>();
async function verifiedMintDecimals(mint:string):Promise<number>{
 const hit=decimalsCache.get(mint);
 if(hit&&hit.expires>Date.now())return hit.value;
 const rpc=process.env.SENDA_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
 const r=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",
    params:[mint,{encoding:"jsonParsed",commitment:"confirmed"}]}),
   signal:AbortSignal.timeout(6500),redirect:"error"});
 if(!r.ok)throw Error("Mint precision verification unavailable");
 const body=await r.json() as {result?:{value?:{owner?:string;data?:{parsed?:{type?:string;info?:{decimals?:number}}}}}};
 const account=body.result?.value,program=account?.owner;
 const decimals=account?.data?.parsed?.type==="mint"?account.data.parsed.info?.decimals:undefined;
 if(!["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
   "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"].includes(program||"") ||
   !Number.isInteger(decimals)||decimals!<0||decimals!>18)
  throw Error("Token mint decimals could not be verified");
 decimalsCache.set(mint,{value:decimals!,expires:Date.now()+120000});
 return decimals!;
}
async function quoteExact(inputMint:string,outputMint:string,amount:string):Promise<Record<string,unknown>>{
 if(!rawDigits.test(amount))throw Error("Invalid exact raw amount");
 const qs=new URLSearchParams({inputMint,outputMint,amount,slippageBps:"100",restrictIntermediateTokens:"true"});
 let last="Jupiter unreachable.";
 for(const makeUrl of QUOTE_URLS){
  try{
   const key=process.env.SENDA_JUPITER_API_KEY;
   const response=await fetch(makeUrl(qs.toString()),{
    headers:{accept:"application/json",...(key?{"x-api-key":key}:{})},
    signal:AbortSignal.timeout(8500),redirect:"error"
   });
   if(!response.ok){last=response.status===429?"Jupiter rate limit reached":`Jupiter HTTP ${response.status}`;continue;}
   const body=await response.json() as Record<string,unknown>;
   if(body.inputMint!==inputMint||body.outputMint!==outputMint||body.inAmount!==amount||
     typeof body.outAmount!=="string"||!rawDigits.test(body.outAmount)||
     typeof body.otherAmountThreshold!=="string"||!rawDigits.test(body.otherAmountThreshold)||
     BigInt(body.otherAmountThreshold)>BigInt(body.outAmount))
     throw Error("Jupiter quote pair, amount or minimum output mismatch");
   return body;
  }catch(e){last=e instanceof Error?e.message:"Jupiter quote unavailable";}
 }
 throw Error(last);
}
export async function fetchQuote(mint:string,usd:number,side:"buy"|"sell"):Promise<JupQuote|{error:string}>{
 try{
  if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)||!Number.isFinite(usd)||usd<=0||usd>1000000)
   throw Error("Invalid quote amount or mint");
  const usdcRaw=String(Math.round(usd*1e6));
  let inputMint=USDC,outputMint=mint,inputRaw=usdcRaw,inputDecimals=6;
  if(side==="sell"){
   // A $25 sell is NOT 25,000,000 raw units of an arbitrary token.
   // Discover an indicative mint-sized position from a $25 *buy* observation,
   // then quote the exact raw mint amount back to USDC.
   const reverse=await quoteExact(USDC,mint,usdcRaw);
   inputRaw=String(reverse.outAmount);
   inputDecimals=await verifiedMintDecimals(mint);
   inputMint=mint;outputMint=USDC;
  }
  const body=await quoteExact(inputMint,outputMint,inputRaw);
  return {
   inAmount:inputRaw,outAmount:String(body.outAmount),
   otherAmountThreshold:String(body.otherAmountThreshold),
   priceImpactPct:String(body.priceImpactPct??"0"),
   slippageBps:Number(body.slippageBps??100),
   route:routeLabels(body),
   swapUsdValue:body.swapUsdValue!=null?String(body.swapUsdValue):null,
   inMint:inputMint,outMint:outputMint,side,inputDecimals
  };
 }catch(e){return {error:e instanceof Error?e.message:"Jupiter quote unavailable"};}
}

export const quoteJup = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        mint: z.string().min(32).max(48),
        usd: z.number().positive().max(1_000_000),
        side: z.enum(["buy", "sell"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<JupQuote | { error: string }> => fetchQuote(data.mint, data.usd, data.side));

export function outUi(q: JupQuote, decimals = 6): number {
  return Number(q.outAmount) / 10 ** decimals;
}

export function inUi(q: JupQuote, decimals = 6): number {
  return Number(q.inAmount) / 10 ** (q.inputDecimals ?? decimals);
}

export function jupFillUrl(mint: string, side: "buy" | "sell"): string {
  return side === "buy"
    ? `https://jup.ag/swap/${USDC}-${mint}`
    : `https://jup.ag/swap/${mint}-${USDC}`;
}

/** Jupiter sends a fraction at or under 1, and a percent when the number is already above 1. */
export function impactFromRaw(priceImpactPct: string | number | undefined | null): number {
  const n = Math.abs(Number(priceImpactPct) || 0);
  return n > 1 ? n : n * 100;
}

export function impactPct(q: JupQuote): number {
  return impactFromRaw(q.priceImpactPct);
}
