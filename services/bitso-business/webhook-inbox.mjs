/**
 * Durable webhook inbox contract for Bitso.
 * Inject a database implementing atomicInsert and enqueueDurably in ONE transaction.
 * Never acknowledge a notification unless its receipt and job are durable.
 * A webhook alone cannot advance a fiat settlement state.
 */
export function createBitsoWebhookInbox({verifier,store,providerAccountId,now=()=>new Date().toISOString()}={}){
 if(!verifier || typeof verifier.verify!=="function")throw new Error("Webhook verifier required");
 if(!store || typeof store.transaction!=="function")throw new Error("Transactional inbox store required");
 if(typeof providerAccountId!=="string"||!providerAccountId.trim())throw new Error("Provider account binding required");
 return Object.freeze({
  async receive({rawBody,headers}){
   const e=await verifier.verify({rawBody,headers});
   const key=["bitso",providerAccountId,e.eventType,e.providerId,e.status,e.payloadSha256].join(":");
   const result=await store.transaction(async tx=>{
    if(typeof tx.insertIfAbsent!=="function" || typeof tx.enqueue!=="function")
     throw new Error("Inbox storage contract missing");
    const inserted=await tx.insertIfAbsent({
     id:key,provider:"bitso",accountId:providerAccountId,
     eventType:e.eventType,providerId:e.providerId,
     status:e.status,payloadSha256:e.payloadSha256,
     createdAt:now(),state:"reconciliation_required"
    });
    if(inserted){
     await tx.enqueue({kind:"bitso-provider-reconcile",inboxId:key,
      providerId:e.providerId,eventType:e.eventType,accountId:providerAccountId});
    }
    return {accepted:true,duplicate:!inserted,reconciliationRequired:true};
   });
   return Object.freeze(result);
  }
 });
}
/**
 * Provider status is an untrusted *input* until obtained via an authenticated GET.
 * This reducer does not issue payouts or treat webhooks as finality.
 */
export function compareBitsoWithdrawal({expected,observed}={}){
 const failures=[];
 if(!expected||!observed)throw new Error("Expected intent and authenticated status required");
 if(observed.source!=="authenticated-provider-query")failures.push("provider-auth");
 if(observed.originId!==expected.originId)failures.push("origin-id");
 if(observed.wid!==expected.wid)failures.push("withdrawal-id");
 if(String(observed.currency).toLowerCase()!=="mxn")failures.push("currency");
 if(observed.amount!==expected.amount)failures.push("amount");
 if(observed.beneficiaryFingerprint!==expected.beneficiaryFingerprint)failures.push("beneficiary");
 if(!["pending","processing","complete","failed"].includes(observed.status))failures.push("status");
 // A complete Bitso withdrawal must also match independently acquired bank evidence.
 if(observed.status==="complete" &&
   (!observed.bankSettlementId||observed.bankSettled!==true))failures.push("bank-settlement");
 return Object.freeze({
  matched:failures.length===0,
  status:failures.length?"reconciliation_required":
   observed.status==="complete"?"payout_settled":
   observed.status==="failed"?"failed":"payout_processing",
  failures
 });
}
