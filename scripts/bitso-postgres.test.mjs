import test from "node:test";
import assert from "node:assert/strict";
import {createPostgresBitsoInboxStore,claimBitsoReconciliationJobs} from "../services/bitso-business/postgres-inbox.mjs";
function db({rejectJob=false}={}){
 const log=[];
 const client={
  async query(sql,params){
   log.push({sql,params});
   if(rejectJob && sql.includes("INSERT INTO bitso_business.reconciliation_outbox"))
    throw new Error("durable queue unavailable");
   if(sql.includes("INSERT INTO bitso_business.webhook_inbox"))return {rowCount:1};
   if(sql.includes("RETURNING o.id"))return {rows:[{id:1,inbox_id:"event",attempts:1}]};
   return {rowCount:0};
  },
  release(){log.push({sql:"RELEASE"});}
 };
 return {pool:{connect:async()=>client},log};
}
const row={id:"bitso:acct:withdrawal:wid:processing:"+"a".repeat(64),provider:"bitso",
 accountId:"acct",eventType:"withdrawal",providerId:"wid",status:"processing",
 payloadSha256:"a".repeat(64)};
test("atomic PostgreSQL inbox and outbox commit once",async()=>{
 const d=db(),store=createPostgresBitsoInboxStore(d.pool);
 const result=await store.transaction(async tx=>{
  assert.equal(await tx.insertIfAbsent(row),true);
  await tx.enqueue({kind:"bitso-provider-reconcile",inboxId:row.id,
   accountId:"acct",providerId:"wid",eventType:"withdrawal"});
  return "done";
 });
 assert.equal(result,"done");
 assert.deepEqual(d.log.map(x=>x.sql.includes("INSERT")?"INSERT":x.sql),[
  "BEGIN","INSERT","INSERT","COMMIT","RELEASE"
 ]);
 for(const entry of d.log.filter(x=>x.params))assert.equal(entry.params.length,entry.sql.includes("webhook_inbox")?7:5);
});
test("job persistence failure rolls back inbox receipt",async()=>{
 const d=db({rejectJob:true}),store=createPostgresBitsoInboxStore(d.pool);
 await assert.rejects(store.transaction(async tx=>{
  await tx.insertIfAbsent(row);
  await tx.enqueue({kind:"bitso-provider-reconcile",inboxId:row.id,
   accountId:"acct",providerId:"wid",eventType:"withdrawal"});
 }),/queue unavailable/);
 assert.ok(d.log.some(x=>x.sql==="ROLLBACK"));
 assert.ok(!d.log.some(x=>x.sql==="COMMIT"));
 assert.equal(d.log.at(-1).sql,"RELEASE");
});
test("private worker claims jobs with SKIP LOCKED and hard cap",async()=>{
 const d=db();
 assert.equal((await claimBitsoReconciliationJobs(d.pool,{limit:2}))[0].inbox_id,"event");
 assert.ok(d.log.some(x=>x.sql.includes("SKIP LOCKED")));
 await assert.rejects(claimBitsoReconciliationJobs(d.pool,{limit:21}),/limit/);
});
