import test from "node:test";import assert from "node:assert/strict";
import {createMoneyIntent,recordProviderTransition,canDisplayDelivered,publicMoneyState} from "../src/lib/money-settlement-core.mjs";
const now=Date.now()-10000;
const input={id:"transfer:abc123",source:"payer:abcd123",recipient:"friend:abcd123",amountCents:2500,createdAt:now};
const event=(step,n)=>({id:"event:"+n+"abcd123",transferId:input.id,next:step,occurredAt:now+n,provider:"processor:approved",reference:"receipt:verified123"});
test("card click never credits or delivers funds",()=>{
 const i=createMoneyIntent(input);assert.equal(canDisplayDelivered(i),false);
 assert.throws(()=>recordProviderTransition(i,event("settled",1),true));
 assert.throws(()=>recordProviderTransition(i,event("funding-pending",1),false));
});
test("verified card acquiring -> settlement -> payout -> delivery",()=>{
 let i=createMoneyIntent(input);
 for(const [n,state] of ["funding-pending","authorized","settled","payout-pending","delivered"].entries()){
  i=recordProviderTransition(i,event(state,n+1),true);
 }
 assert.equal(canDisplayDelivered(i),true);
 assert.equal(publicMoneyState(i).delivered,true);
 const duplicate=recordProviderTransition(i,event("delivered",5),true);
 assert.equal(duplicate.version,i.version);
});
test("wrong payment, same event with different transfer, and missing settlement denied",()=>{
 const i=createMoneyIntent(input);
 assert.throws(()=>recordProviderTransition(i,{...event("funding-pending",1),transferId:"transfer:wrong"},true));
 assert.throws(()=>recordProviderTransition(i,event("delivered",1),true));
 const funded=recordProviderTransition(i,event("funding-pending",1),true);
 assert.equal(publicMoneyState(funded).delivered,false);
});
test("invalid amount and unverified providers fail closed",()=>{
 assert.throws(()=>createMoneyIntent({...input,amountCents:0}));
 let i=createMoneyIntent(input);i=recordProviderTransition(i,event("funding-pending",1),true);
 i=recordProviderTransition(i,event("authorized",2),true);
 assert.throws(()=>recordProviderTransition(i,{...event("settled",3),provider:""},true));
});
