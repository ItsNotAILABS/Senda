import test from "node:test";
import assert from "node:assert/strict";
import {createBitsoNonceAllocator} from "../services/bitso-business/db-nonce.mjs";
import {reconcileBitsoBatch} from "../services/bitso-business/reconciliation-worker.mjs";
import {runBitsoReconciliation} from "../services/bitso-business/run-reconciliation.mjs";

test("nonce allocation uses atomic upsert, hashes API key and returns decimal value",async()=>{
 const calls=[];
 const pool={async query(sql,args){
  calls.push({sql,args});
  return {rows:[{nonce:"1764000000000000"}]};
 }};
 const alloc=createBitsoNonceAllocator(pool,{apiKey:"test-read-key",clock:()=>1764000000000});
 assert.equal(await alloc.next(),"1764000000000000");
 assert.match(calls[0].sql,/ON CONFLICT/);
 assert.match(calls[0].sql,/GREATEST/);
 assert.equal(calls[0].args[0].length,64);
 assert.ok(!JSON.stringify(calls).includes("test-read-key"));
});
test("worker never performs lookup without durable approved intent link",async()=>{
 const executed=[];
 const pool={async connect(){
  return {query:async(sql)=>{
   if(sql==="BEGIN"||sql==="COMMIT")return {rows:[]};
   if(sql.includes("WITH picked"))return {rows:[{
    id:"23",inbox_id:"event",account_id:"authorized-account",
    provider_id:"wid-1",event_type:"withdrawal",attempts:1
   }]};
   if(sql.includes("UPDATE bitso_business.reconciliation_outbox")){
    return {rowCount:1,rows:[{id:"23"}]};
   }
   throw new Error("Unexpected SQL");
  },release(){}};
 }};
 const result=await reconcileBitsoBatch({
  pool,reader:{async byOriginId(){executed.push("read");return []}},
  resolveApprovedOriginId:async()=>null,accountId:"authorized-account"
 });
 assert.equal(result.claimed,1);
 assert.equal(result.results[0].result,"deferred");
 assert.equal(executed.length,0);
 assert.equal(result.fiatSettlementsConfirmed,0);
});
test("worker configuration fails closed without any provider calls",async()=>{
 const state=await runBitsoReconciliation({env:{},poolFactory:()=>{throw Error("should not connect");}});
 assert.equal(state.enabled,false);
});
