import test from "node:test";
import assert from "node:assert/strict";
import { createFinanceClient } from "./client.mjs";
const token="secret".repeat(8);
test("no production client without configured service token",()=>{
 assert.throws(()=>createFinanceClient({origin:"https://finance.example",token:"x"}),/credential/);
 assert.throws(()=>createFinanceClient({origin:"http://public.example",token}),/TLS/);
});
test("risk calls only declared upstream path, never signs",async()=>{
 let path="",body={};
 const client=createFinanceClient({origin:"https://finance.example",token,
  fetchImpl:async(url,init)=>{
   path=String(url);body=JSON.parse(init.body);
   return {ok:true,json:async()=>({schema:"parralax.response.v1",requestId:"r1",kind:"non-executing-analysis",result:{decision:"DENY",reasons:["STALE_QUOTE"]}})};
  }});
 const r=await client.risk("r1",{instrument:"SOL"});
 assert.equal(path,"https://finance.example/v1/risk/evaluate");
 assert.equal(body.schema,"senda.parralax.request.v1");
 assert.equal(r.filled,false);assert.equal(r.signed,false);
});
test("rejects forged response",async()=>{
 const client=createFinanceClient({origin:"https://finance.example",token,
  fetchImpl:async()=>({ok:true,json:async()=>({schema:"parralax.response.v1",requestId:"wrong",kind:"non-executing-analysis",result:{}})})});
 await assert.rejects(()=>client.exitPlan("r2",{}),/mismatch/);
});
test("rejects unknown action via restricted public client",()=>{
 const c=createFinanceClient({origin:"https://finance.example",token});
 assert.equal("submitOrder" in c,false);assert.equal("walletSign" in c,false);
});
