import test from "node:test";
import assert from "node:assert/strict";
import {createPretradeClient} from "./client.mjs";
const token="token-".repeat(8),mint="So11111111111111111111111111111111111111112";
const order={requestId:"req1",tenantId:"t1",agentId:"a1",venue:"jupiter",mint,side:"buy",
 notionalUsd:10,leverage:1,priceImpactBps:5,slippageBps:10,limits:{maxOrderUsd:100000}};
test("client strips agent-crafted risk policy values",async()=>{
 let body;
 const c=createPretradeClient({origin:"https://parralax.internal.example",serviceToken:token,
  fetchImpl:async(_url,opts)=>{
   body=JSON.parse(opts.body);
   return {ok:true,json:async()=>({schema:"parralax.pretrade.response.v1",requestId:"req1",
     decision:"APPROVAL_REQUIRED",executionAuthorized:false})};
  }});
 const result=await c.review({order,quoteId:"quote1",principal:"trusted-service"});
 assert.equal(result.signed,false);assert.equal(result.filled,false);
 assert.equal(body.order.limits,undefined);
 assert.equal(body.schema,"senda.pretrade.request.v1");
});
test("rejects unauthorized-looking responses",async()=>{
 const c=createPretradeClient({origin:"https://parralax.internal.example",serviceToken:token,
  fetchImpl:async()=>({ok:true,json:async()=>({schema:"parralax.pretrade.response.v1",
   requestId:"req1",decision:"APPROVAL_REQUIRED",executionAuthorized:true})})});
 await assert.rejects(c.review({order,quoteId:"quote1",principal:"trusted-service"}));
});
test("no execution surface, and no public insecure origin",()=>{
 const c=createPretradeClient({origin:"https://parralax.internal.example",serviceToken:token});
 assert.deepEqual(Object.keys(c),["review"]);
 assert.throws(()=>createPretradeClient({origin:"http://arbitrary.example",serviceToken:token}));
 assert.throws(()=>createPretradeClient({origin:"https://parralax.internal.example",serviceToken:"weak"}));
});
