/**
 * Read-only Bitso reconciliation coordinator. No customer payout / FX writes.
 * Resolves an origin_id only from an approved internal intent mapping.
 */
import {claimBitsoReconciliationJobs,completeBitsoReconciliation,deferBitsoReconciliation} from "./postgres-inbox.mjs";

export async function reconcileBitsoBatch({
 pool,reader,resolveApprovedOriginId,accountId,limit=10
}={}){
 if(!pool || typeof reader?.byOriginId!=="function" ||
    typeof resolveApprovedOriginId!=="function" || !accountId)
  throw new Error("Reconciliation dependencies and provider account binding required");
 const claimed=await claimBitsoReconciliationJobs(pool,{limit});
 const results=[];
 for(const job of claimed){
  try{
   if(job.account_id!==accountId || job.event_type!=="withdrawal"){
    await deferBitsoReconciliation(pool,{job,reason:"unsupported_or_wrong_account"});
    results.push({jobId:job.id,result:"deferred"});
    continue;
   }
   const originId=await resolveApprovedOriginId({
    accountId,providerWithdrawalId:job.provider_id
   });
   if(typeof originId!=="string"||!/^[A-Za-z0-9_-]{1,40}$/.test(originId)){
    await deferBitsoReconciliation(pool,{job,reason:"intent_mapping_missing"});
    results.push({jobId:job.id,result:"deferred"});
    continue;
   }
   const rows=await reader.byOriginId(originId);
   const found=rows.filter(r=>r.wid===job.provider_id && r.originId===originId);
   if(found.length!==1){
    await deferBitsoReconciliation(pool,{job,reason:"provider_match_missing"});
    results.push({jobId:job.id,result:"deferred"});
    continue;
   }
   const record=found[0];
   if(!["pending","processing","complete","failed"].includes(record.status)||
      String(record.currency).toLowerCase()!=="mxn"){
    await deferBitsoReconciliation(pool,{job,reason:"provider_response_invalid"});
    results.push({jobId:job.id,result:"deferred"});
    continue;
   }
   // Status snapshots are NOT final beneficiary bank receipts.
   await completeBitsoReconciliation(pool,{job,observation:{
    source:"authenticated-provider-query",providerId:job.provider_id,
    status:record.status,currency:"mxn",amount:record.amount,
    originId
   }});
   results.push({jobId:job.id,result:"observed",settlementVerified:false});
  }catch{
   // No blind payout retry or guessed settlement; preserve retryable job.
   try{await deferBitsoReconciliation(pool,{job,reason:"provider_lookup_failed"});}
   catch{/* lease expires and another worker may recover it */}
   results.push({jobId:job.id,result:"deferred"});
  }
 }
 return Object.freeze({claimed:claimed.length,results,fiatSettlementsConfirmed:0});
}
