/** Public Solana wallet history reader. No signing authority and no customer cash ledger. */
import {createServerFn} from "@tanstack/react-start";
import {PublicKey} from "@solana/web3.js";
import {z} from "zod";
import {normalizeWalletActivity,selectActivityPage} from "@/lib/wallet-activity-core.mjs";

const SIGNATURE=/^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
const USDC=new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN=new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA=new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const cursorSchema=z.object({wallet:z.string().regex(SIGNATURE).nullable(),usdc:z.string().regex(SIGNATURE).nullable()});
const params=z.object({owner:z.string().min(32).max(44),cursor:cursorSchema.optional(),limit:z.number().int().min(1).max(30).default(20)});
function endpoints(){
 const env=process.env.SENDA_SOLANA_RPC_URL;
 const list=[env,"https://api.mainnet-beta.solana.com","https://solana-rpc.publicnode.com"].filter((s):s is string=>Boolean(s));
 return [...new Set(list)].filter(address=>{
  try{const u=new URL(address);return u.protocol==="https:"&&!!u.hostname&&!u.username&&!u.password}
  catch{return false}
 });
}
async function rpc(method:string,params:unknown[]){
 let error="Solana history provider unavailable";
 for(const endpoint of endpoints()){
  try{
   const response=await fetch(endpoint,{
    method:"POST",headers:{"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),
    signal:AbortSignal.timeout(9000),redirect:"error"
   });
   if(!response.ok){error="Solana RPC HTTP "+response.status;continue}
   const value=await response.json() as {jsonrpc?:string;error?:{message?:string};result?:unknown};
   if(value.error){error="Solana RPC refused "+method;continue}
   if(!("result" in value))throw Error("Missing Solana RPC result");
   return value.result;
  }catch{error="Solana history RPC timed out or returned an invalid response"}
 }
 throw Error("Unable to verify chain activity. "+error);
}
type SigRow={signature:string;slot:number;blockTime?:number|null;err?:unknown};
export const getWalletActivity=createServerFn({method:"POST"})
 .validator((input:unknown)=>params.parse(input))
 .handler(async({data})=>{
  let owner:PublicKey;
  try{owner=new PublicKey(data.owner)}catch{throw Error("Invalid Solana wallet address")}
  const address=owner.toBase58();
  const [usdcAta]=PublicKey.findProgramAddressSync([owner.toBuffer(),TOKEN.toBuffer(),USDC.toBuffer()],ATA);
  const now=Date.now(),limit=data.limit,before=data.cursor;
  const query=(key:PublicKey,cursor:string|null|undefined)=>
   rpc("getSignaturesForAddress",[key.toBase58(),{
    limit,commitment:"confirmed",...(cursor?{before:cursor}:{})
   }]) as Promise<SigRow[]>;
  const [wallet,usdc]=await Promise.all([
   query(owner,before?.wallet),query(usdcAta,before?.usdc)
  ]);
  if(!Array.isArray(wallet)||!Array.isArray(usdc))
   throw Error("Solana activity source returned an invalid page");
  const page=selectActivityPage({wallet,usdc,limit,before:{
   wallet:before?.wallet??null,usdc:before?.usdc??null
  }});
  const entries=page.entries;
  if(!entries.length)return {schema:"senda.wallet-activity.v1" as const,owner:address,
   network:"mainnet-beta" as const,observedAt:now,rows:[],nextCursor:page.nextCursor,
   pageScope:page.pageScope,source:"Solana mainnet RPC"};
  const statusResult=await rpc("getSignatureStatuses",[
   entries.map(x=>x.signature),{searchTransactionHistory:true}
  ]) as {value?:Array<{err?:unknown;confirmationStatus?:string|null;slot?:number}|null>}|null;
  if(!Array.isArray(statusResult?.value)||statusResult.value.length!==entries.length)
   throw Error("Solana RPC did not provide matching confirmation statuses");
  // Transaction metadata is enrichment only; no amount is displayed from an unverified transfer.
  const transactions:Record<string,unknown>={};
  const eligible=entries.filter((x,i)=>{
   const state=statusResult.value?.[i];
   return state&&state.err===null&&["confirmed","finalized"].includes(String(state.confirmationStatus));
  }).slice(0,20);
  for(let i=0;i<eligible.length;i+=4){
   await Promise.all(eligible.slice(i,i+4).map(async row=>{
    try{transactions[row.signature]=await rpc("getTransaction",[
     row.signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:0}
    ])}catch{/* No invented token amount when RPC details unavailable. */}
   }));
  }
  const rows=normalizeWalletActivity({owner:address,entries,statuses:statusResult.value,transactions,now});
  return {schema:"senda.wallet-activity.v1" as const,owner:address,network:"mainnet-beta" as const,
   observedAt:now,rows,nextCursor:page.nextCursor,pageScope:page.pageScope,source:"Solana mainnet RPC"};
 });
