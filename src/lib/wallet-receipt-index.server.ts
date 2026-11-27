/** Opt-in durable public-chain receipt index. Private wallet labels are never persisted. */
import {createServerFn} from "@tanstack/react-start";
import {PublicKey} from "@solana/web3.js";
import {z} from "zod";
import {getSql} from "@/lib/db";
import {getSessionUser,UnauthorizedError} from "@/lib/auth/verify.server";
import {readVerifiedReceiptPage,persistVerifiedReceipts,type SqlQuery} from "@/lib/wallet-chain-receipt-index.mjs";
import type {WalletActivityRow} from "@/lib/wallet-activity-core.mjs";

function enabled(){
 return process.env.SENDA_ACTIVITY_INDEX_ENABLED==="true"&&Boolean(process.env.DATABASE_URL?.trim());
}
/**
 * Server-internal only. The source must be getWalletActivity()'s parsed and
 * RPC-verified rows, never incoming client objects.
 */
export async function indexChainReceiptsFromRpc(rows:WalletActivityRow[],owner:string){
 if(!enabled())return {status:"disabled" as const,stored:0};
 const sql=await getSql();
 const saved=await persistVerifiedReceipts(
  (statement,values)=>sql.query(statement,values),
  rows,owner
 );
 return {status:"indexed" as const,stored:saved.stored};
}
const receiptCursor=z.object({slot:z.number().int().positive(),signature:z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/)});
const schema=z.object({owner:z.string().min(32).max(44),
 limit:z.number().int().min(1).max(50).default(30),
 olderThanSlot:z.number().int().positive().nullable().optional(),
 cursor:receiptCursor.nullable().optional()}).refine(x=>!(x.cursor&&x.olderThanSlot!=null),{
 message:"Provide either cursor or olderThanSlot, not both"});
/**
 * Public-chain-only indexed receipts behind account authentication.
 * A Senda session is NOT proof of ownership of the queried public Solana wallet.
 * No notes, billing identity or account-specific private metadata are returned.
 */
export const getIndexedChainReceipts=createServerFn({method:"POST"})
 .validator((input:unknown)=>schema.parse(input))
 .handler(async({data})=>{
  if(!enabled())return {available:false as const,scope:"public-chain-only" as const,rows:[]};
  const session=await getSessionUser();
  if(!session)throw new UnauthorizedError();
  let owner:string;
  try{owner=new PublicKey(data.owner).toBase58()}
  catch{throw Error("Invalid Solana address")}
  const sql=await getSql();
  const page=await readVerifiedReceiptPage(
   (statement,values)=>sql.query(statement,values),
   {owner,network:"mainnet-beta",limit:data.limit,
     olderThanSlot:data.olderThanSlot??null,cursor:data.cursor??null}
  );
  return {available:true as const,scope:"public-chain-only" as const,network:"mainnet-beta" as const,
   owner,rows:page.rows,nextCursor:page.nextCursor,hasMore:page.hasMore,
   source:"verified RPC receipt index; not a deposit ledger" as const};
 });
