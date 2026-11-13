/** Live-source token inspection for Senda. Read-only; never a guarantee against rugs. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { classifySolanaMintAccount } from "@/lib/ecosystem-upgrade-core.mjs";

type MintEvidence={
  status:"observed"|"unavailable";
  mint:string;rpcSlot:number|null;tokenProgram:string|null;
  decimals:number|null;mintAuthorityPresent:boolean|null;freezeAuthorityPresent:boolean|null;
  extensions:string[];riskFlags:string[];requiresExtensionAwareExecution:boolean;
  jupiterVerified:boolean|null;organicScore:number|null;liquidityUsd:number|null;
  observedAt:string;warning:string;
};
const validator=z.object({mint:z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)});
const empty=(mint:string,warning:string):MintEvidence=>({
 status:"unavailable",mint,rpcSlot:null,tokenProgram:null,decimals:null,
 mintAuthorityPresent:null,freezeAuthorityPresent:null,extensions:[],riskFlags:[],
 requiresExtensionAwareExecution:false,jupiterVerified:null,organicScore:null,
 liquidityUsd:null,observedAt:new Date().toISOString(),warning
});
export const inspectSolanaToken=createServerFn({method:"POST"})
 .middleware([authMiddleware])
 .validator((input:unknown)=>validator.parse(input))
 .handler(async({data}):Promise<MintEvidence>=>{
  const rpc=process.env.SENDA_SOLANA_RPC_URL;
  const key=process.env.SENDA_JUPITER_API_KEY;
  if(!rpc || !key)return empty(data.mint,"Configure private Solana RPC and Jupiter Tokens V2 API credentials.");
  const root=new URL(rpc);
  if(root.protocol!=="https:"||root.username||root.password||root.hash)
   return empty(data.mint,"Unsafe RPC origin configured.");
  // Quotes use mainnet token identity. Devnet/testnet RPCs cannot satisfy
  // a mainnet mint-risk check, even if an account happens to share the address.
  try{
   const network=await fetch(rpc,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getGenesisHash"}),
    signal:AbortSignal.timeout(4500),redirect:"error"
   });
   const result=(await network.json()) as {result?:string};
   if(!network.ok||result.result!=="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d")
    return empty(data.mint,"RPC is not verified as Solana mainnet.");
  }catch{return empty(data.mint,"Could not verify Solana mainnet RPC.");}
  let rpcJson:unknown;
  try{
   const r=await fetch(rpc,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",
      params:[data.mint,{encoding:"jsonParsed",commitment:"confirmed"}]}),
    signal:AbortSignal.timeout(6000),redirect:"error"
   });
   if(!r.ok)return empty(data.mint,"Mint RPC is unavailable.");
   rpcJson=await r.json();
  }catch{return empty(data.mint,"Mint RPC is unavailable.");}
  const rpcBody=rpcJson as {result?:{context?:{slot?:number};value?:unknown}};
  const classification=classifySolanaMintAccount(rpcBody?.result?.value);
  if(classification.decision==="DENY")
   return empty(data.mint,"Mint ownership or extensions cannot be independently decoded.");
  const mintInfo=classification as {
    tokenProgram:string;decimals:number;mintAuthorityPresent:boolean;freezeAuthorityPresent:boolean;
    extensions:string[];transferRisks:string[];requiresExtensionAwareExecution:boolean
  };
  let metadata:unknown=null;
  try{
   const u=new URL("https://api.jup.ag/tokens/v2/search");
   u.searchParams.set("query",data.mint);
   const r=await fetch(u,{headers:{"x-api-key":key,"accept":"application/json"},
     signal:AbortSignal.timeout(5500),redirect:"error"});
   if(r.ok){const value:unknown=await r.json();if(Array.isArray(value)){
    metadata=value.find((row:unknown)=>row!=null&&typeof row==="object"&&
      (row as {id?:string}).id===data.mint)??null;
   }}
  }catch{/* RPC mint proof is still useful without Jupiter token enrichment. */}
  const token=metadata as {isVerified?:boolean;organicScore?:number;liquidity?:number;tokenProgram?:string}|null;
  const riskFlags=[...mintInfo.transferRisks];
  if(mintInfo.mintAuthorityPresent)riskFlags.push("MINT_AUTHORITY_PRESENT");
  if(mintInfo.freezeAuthorityPresent)riskFlags.push("FREEZE_AUTHORITY_PRESENT");
  if(token?.tokenProgram && token.tokenProgram!==mintInfo.tokenProgram)riskFlags.push("TOKEN_PROGRAM_PROVIDER_MISMATCH");
  return {
   status:"observed",mint:data.mint,
   rpcSlot:Number.isSafeInteger(rpcBody?.result?.context?.slot)?rpcBody.result!.context!.slot!:null,
   tokenProgram:mintInfo.tokenProgram,decimals:mintInfo.decimals,
   mintAuthorityPresent:mintInfo.mintAuthorityPresent,
   freezeAuthorityPresent:mintInfo.freezeAuthorityPresent,
   extensions:mintInfo.extensions,riskFlags,
   requiresExtensionAwareExecution:mintInfo.requiresExtensionAwareExecution,
   jupiterVerified:typeof token?.isVerified==="boolean"?token.isVerified:null,
   organicScore:typeof token?.organicScore==="number"&&Number.isFinite(token.organicScore)?token.organicScore:null,
   liquidityUsd:typeof token?.liquidity==="number"&&Number.isFinite(token.liquidity)?token.liquidity:null,
   observedAt:new Date().toISOString(),
   warning:"Source observations only, not a security guarantee or authorization to trade. Mint extensions, token accounts and swap transaction require full pre-sign verification."
  };
 });
