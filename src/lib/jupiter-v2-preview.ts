/** Read-only Jupiter Swap V2 meta-aggregator preview. Never returns a transaction. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { validateSwapV2Preview } from "@/lib/ecosystem-upgrade-core.mjs";

const mint=z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const inputSchema=z.object({
  inputMint: mint, outputMint: mint,
  amount: z.string().regex(/^[1-9][0-9]{0,12}$/)
}).refine(x=>x.inputMint!==x.outputMint,"Mints must differ");
export type JupiterV2Preview={
  schema:"senda.jupiter.swap-quote.v2";status:"indicative-only";
  inputMint:string;outputMint:string;inAmount:string;outAmount:string;
  router:string;mode:string;feeBps:number;observedAt:number;
  requiresFreshOrder:true;requiresWalletReview:true;canSign:false;transaction:null;
};
export const getJupiterV2Preview=createServerFn({method:"POST"})
  .middleware([authMiddleware])
  .validator((input:unknown)=>inputSchema.parse(input))
  .handler(async({data}):Promise<JupiterV2Preview>=>{
    // This is deliberately separate from Senda's existing wallet-owned execution paths.
    const key=process.env.SENDA_JUPITER_API_KEY;
    if(!key)throw Error("Jupiter V2 server API key is not configured");
    const endpoint=new URL("https://api.jup.ag/swap/v2/order");
    endpoint.search=new URLSearchParams({
      inputMint:data.inputMint,outputMint:data.outputMint,amount:data.amount
      // No 'taker' => no transaction is built or forwarded.
    }).toString();
    const response=await fetch(endpoint,{
      headers:{accept:"application/json","x-api-key":key},
      signal:AbortSignal.timeout(8500),redirect:"error"
    });
    if(!response.ok)throw Error(response.status===429
      ?"Jupiter V2 rate limited this preview":"Jupiter V2 is unavailable");
    const raw:unknown=await response.json();
    return validateSwapV2Preview(data,raw,Date.now()) as JupiterV2Preview;
  });
