/**
 * Private, one-shot reconciliation worker. Requires approved Bitso READ credentials.
 * Run through a private scheduler, not from a public route or browser.
 * No FX or payout endpoints are ever called.
 */
import pg from "pg";
import {fileURLToPath} from "node:url";
import {createBitsoNonceAllocator} from "./db-nonce.mjs";
import {createBitsoWithdrawalReader} from "./withdrawal-readonly.mjs";
import {reconcileBitsoBatch} from "./reconciliation-worker.mjs";

export async function runBitsoReconciliation({
 env=process.env,poolFactory=(uri)=>new pg.Pool({connectionString:uri,max:2,
 connectionTimeoutMillis:5000,statement_timeout:8000}),readerFactory=createBitsoWithdrawalReader
}={}){
 if(env.SENDA_BITSO_RECONCILIATION_ENABLED!=="true" ||
    !env.DATABASE_URL?.trim() || !env.SENDA_BITSO_PROVIDER_ACCOUNT_ID?.trim() ||
    !env.BITSO_READ_API_KEY?.trim() || !env.BITSO_READ_API_SECRET?.trim())
  return Object.freeze({enabled:false,reason:"required_private_configuration_missing"});
 if(!["stage","production"].includes(env.BITSO_READ_API_ENV))
  throw new Error("Bitso read-only environment must be explicitly selected");
 const pool=poolFactory(env.DATABASE_URL);
 try{
  const nonce=createBitsoNonceAllocator(pool,{apiKey:env.BITSO_READ_API_KEY});
  const reader=readerFactory({
   environment:env.BITSO_READ_API_ENV,
   key:env.BITSO_READ_API_KEY,secret:env.BITSO_READ_API_SECRET,
   nonceFactory:()=>nonce.next()
  });
  const resolveApprovedOriginId=async({accountId,providerWithdrawalId})=>{
   const result=await pool.query(
    "SELECT origin_id FROM bitso_business.approved_intent_links "+
    "WHERE account_id=$1 AND withdrawal_id=$2",
    [accountId,providerWithdrawalId]
   );
   // Ambiguous/missing mappings never become payout success.
   return result.rows?.length===1?result.rows[0].origin_id:null;
  };
  return await reconcileBitsoBatch({pool,reader,resolveApprovedOriginId,
    accountId:env.SENDA_BITSO_PROVIDER_ACCOUNT_ID,limit:10});
 }finally{await pool.end();}
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
 runBitsoReconciliation().then(result=>{
  // No balances, access tokens, recipients or bank identifiers in worker logs.
  console.log("[bitso-reconciliation]",JSON.stringify({
   enabled:result.enabled!==false,claimed:result.claimed??0,
   deferred:result.results?.filter(r=>r.result==="deferred").length??0,
   observed:result.results?.filter(r=>r.result==="observed").length??0,
   settlementVerified:false
  }));
 }).catch(()=>{console.error("[bitso-reconciliation] failed");process.exitCode=1;});
}
