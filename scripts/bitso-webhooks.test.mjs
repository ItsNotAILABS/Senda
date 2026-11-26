import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createBitsoWebhookVerifier,BITSO_WEBHOOK_KEY_SOURCE} from "../services/bitso-business/webhook-signatures.mjs";
import {createBitsoWebhookInbox,compareBitsoWithdrawal} from "../services/bitso-business/webhook-inbox.mjs";
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const keyId="rotation-1",pub=publicKey.export({format:"der",type:"spki"}).toString("base64");
const p={wid:"wid-1",status:"processing",currency:"mxn",amount:"100.00",details:{origin_id:"senda-a"}};
const headersFor=payload=>({
 "x-bitso-key-id":keyId,
 "x-bitso-webhook-event-signature":sign("RSA-SHA256",Buffer.from(JSON.stringify(payload)),privateKey).toString("base64")
});
function setup(){
 let fetchCount=0;
 return {verifier:createBitsoWebhookVerifier({fetchImpl:async(url,opt)=>{
  fetchCount++;
  assert.equal(url,BITSO_WEBHOOK_KEY_SOURCE);
  assert.equal(opt.redirect,"error");
  return {ok:true,json:async()=>({payload:[{key_id:keyId,public_key:pub}]})};
 }}),count:()=>fetchCount};
}
test("RSA signed webhook validates, cached rotating key, redacted normalized event",async()=>{
 const s=setup();
 const e=await s.verifier.verify({rawBody:JSON.stringify({event:"withdrawal",payload:p}),headers:headersFor(p)});
 assert.equal(e.providerId,"wid-1");
 assert.equal(e.status,"processing");
 assert.equal(e.authenticatedPayload,true);
 assert.equal(e.requiresProviderReconciliation,true);
 assert.equal(e.details,undefined);
 assert.equal(s.count(),1);
 await s.verifier.verify({rawBody:JSON.stringify({event:"withdrawal",payload:p}),headers:headersFor(p)});
 assert.equal(s.count(),1);
});
test("tampered status or amount rejected",async()=>{
 const s=setup();
 await assert.rejects(s.verifier.verify({rawBody:JSON.stringify({event:"withdrawal",payload:{...p,amount:"999"}}),headers:headersFor(p)}),/signature mismatch/);
});
test("unsigned envelope cannot reinterpret withdrawal as funding",async()=>{
 const s=setup();
 await assert.rejects(s.verifier.verify({rawBody:JSON.stringify({event:"funding",payload:p}),headers:headersFor(p)}),/Funding resource mismatch/);
});
test("missing headers, huge body, invalid JSON, malformed key all reject",async()=>{
 const s=setup();
 await assert.rejects(s.verifier.verify({rawBody:"{}",headers:{}}),/headers/);
 await assert.rejects(s.verifier.verify({rawBody:"x".repeat(131073),headers:headersFor(p)}),/size/);
 await assert.rejects(s.verifier.verify({rawBody:"{bad",headers:headersFor(p)}),/JSON/);
 const bad=createBitsoWebhookVerifier({fetchImpl:async()=>({ok:true,json:async()=>({keys:[{key_id:keyId,public_key:"invalid"}]})})});
 await assert.rejects(bad.verify({rawBody:JSON.stringify({event:"withdrawal",payload:p}),headers:headersFor(p)}),/Unrecognized/);
});
test("transactional inbox deduplicates and commits job with event; never settles",async()=>{
 const ids=new Set(),jobs=[];
 const s=setup();
 const inbox=createBitsoWebhookInbox({verifier:s.verifier,providerAccountId:"account-a",store:{
  async transaction(run){
   const backup=new Set(ids),n=jobs.length;
   try{return await run({
    async insertIfAbsent(row){if(ids.has(row.id))return false;ids.add(row.id);return true;},
    async enqueue(job){jobs.push(job);}
   });}catch(e){ids.clear();for(const id of backup)ids.add(id);jobs.length=n;throw e;}
  }
 }});
 const delivery={rawBody:JSON.stringify({event:"withdrawal",payload:p}),headers:headersFor(p)};
 assert.equal((await inbox.receive(delivery)).duplicate,false);
 assert.equal((await inbox.receive(delivery)).duplicate,true);
 assert.equal(jobs.length,1);
 assert.equal(jobs[0].kind,"bitso-provider-reconcile");
});
test("authenticated payout record requires exact beneficiary + independent bank settlement",()=>{
 const expected={originId:"senda-a",wid:"wid-1",amount:"100.00",beneficiaryFingerprint:"hash"};
 const base={source:"authenticated-provider-query",originId:"senda-a",wid:"wid-1",
  amount:"100.00",currency:"mxn",beneficiaryFingerprint:"hash",
  status:"complete",bankSettlementId:"bank-id",bankSettled:true};
 assert.equal(compareBitsoWithdrawal({expected,observed:base}).status,"payout_settled");
 assert.equal(compareBitsoWithdrawal({expected,observed:{...base,bankSettled:false}}).status,"reconciliation_required");
 assert.equal(compareBitsoWithdrawal({expected,observed:{...base,amount:"101.00"}}).matched,false);
 assert.equal(compareBitsoWithdrawal({expected,observed:{...base,source:"webhook"}}).matched,false);
});
