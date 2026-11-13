/** Names, logos, and last prices for the mints a wallet holds. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type HoldMark = {
  symbol: string;
  name: string;
  icon: string;
  usd: number;
  chg: number;
};

export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** One API batch for up to 24 holdings rather than 24 concurrent provider calls. */
export const markHolds = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.array(z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)).max(24).parse(input),
  )
  .handler(async ({ data }): Promise<Record<string, HoldMark>> => {
    const out: Record<string, HoldMark> = {};
    const mints=[...new Set(data)];
    if(mints.length===0)return out;
    const url=new URL("https://api.jup.ag/tokens/v2/search");
    url.searchParams.set("query",mints.join(","));
    try{
      const key=process.env.SENDA_JUPITER_API_KEY;
      const response=await fetch(url,{
        headers:{accept:"application/json",...(key?{"x-api-key":key}:{})},
        signal:AbortSignal.timeout(8500),redirect:"error"
      });
      if(!response.ok)return out;
      const body:unknown=await response.json();
      if(!Array.isArray(body))return out;
      const wanted=new Set(mints);
      for(const value of body){
        const row=value as {id?:string;symbol?:string;name?:string;icon?:string;
          usdPrice?:number;stats24h?:{priceChange?:number}};
        if(!row||typeof row.id!=="string"||!wanted.has(row.id)||
          typeof row.symbol!=="string"||!row.symbol.trim())continue;
        out[row.id]={
          symbol:row.symbol.slice(0,24),name:(row.name||row.symbol).slice(0,100),
          icon:typeof row.icon==="string"?row.icon:"",
          usd:Number.isFinite(row.usdPrice)?Math.max(0,row.usdPrice!):0,
          chg:Number.isFinite(row.stats24h?.priceChange)?row.stats24h!.priceChange!:0
        };
      }
    }catch{/* Keep on-chain wallet balances even if Jupiter metadata is unavailable. */}
    return out;
  });
