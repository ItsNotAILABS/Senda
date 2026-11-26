import test from "node:test";
import assert from "node:assert/strict";
import {handleBitsoWebhook} from "../services/bitso-business/webhook-http.mjs";
const uri="postgres://unit-test:not-real@localhost/test";
const env={DATABASE_URL:uri,SENDA_BITSO_PROVIDER_ACCOUNT_ID:"approved-account",
 SENDA_BITSO_WEBHOOK_ENABLED:"true"};
const payload=JSON.stringify({event:"withdrawal",payload:{wid:"w",status:"processing",currency:"mxn",amount:"4"}});
const event={eventType:"withdrawal",providerId:"w",status:"processing",
 payloadSha256:"a".repeat(64),authenticatedPayload:true,requiresProviderReconciliation:true};
function request(body=payload,headers={"content-type":"application/json"}){
 return new Request("https://senda.pocketnova.app/api/bitso-webhook",
 {method:"POST",headers,body});
}
const verifierFactory=()=>({async verify(){return event;}});
function store({fail=false}={}){
 const sql=[];
 return {sql,poolFactory:()=>({async connect(){return {
  async query(q){
   sql.push(q);
   if(fail&&q.includes("reconciliation_outbox"))throw Error("db down");
   if(q.includes("webhook_inbox"))return {rowCount:1};
   return {rowCount:1};
  },release(){}
 };}})};
}
test("webhook disabled or missing durable database never reads or calls provider",async()=>{
 let called=false;
 const result=await handleBitsoWebhook(request(),{env:{},
  verifierFactory:()=>{called=true;throw Error("invalid");},
  poolFactory:()=>{called=true;throw Error("invalid");}});
 assert.equal(result.status,503);
 assert.equal(called,false);
});
test("content-type mismatch and overlarge payload are rejected before DB",async()=>{
 assert.equal((await handleBitsoWebhook(request("x",{"content-type":"text/plain"}),{env})).status,415);
 assert.equal((await handleBitsoWebhook(request("x".repeat(131073)),{env})).status,413);
});
test("signed verified event is committed atomically before 202",async()=>{
 const db=store();
 const response=await handleBitsoWebhook(request(),{env,
  verifierFactory,poolFactory:db.poolFactory});
 assert.equal(response.status,202);
 assert.equal((await response.json()).reconciliationRequired,true);
 assert.ok(db.sql.includes("COMMIT"));
 assert.ok(db.sql.some(x=>x.includes("INSERT INTO bitso_business.reconciliation_outbox")));
});
test("DB failure means retryable HTTP status without acknowledgement",async()=>{
 const db=store({fail:true});
 const response=await handleBitsoWebhook(request(),{env,
  verifierFactory,poolFactory:db.poolFactory});
 assert.equal(response.status,503);
 assert.ok(db.sql.includes("ROLLBACK"));
});
test("invalid RSA verification rejects without any persistence",async()=>{
 let poolUsed=false;
 const response=await handleBitsoWebhook(request(),{env,
  verifierFactory:()=>({async verify(){throw Error("bad signature");}}),
  poolFactory:()=>{poolUsed=true;throw Error("fail");}});
 assert.equal(response.status,401);
 assert.equal(poolUsed,false);
});
