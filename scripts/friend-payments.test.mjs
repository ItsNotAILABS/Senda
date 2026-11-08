import test from "node:test";import assert from "node:assert/strict";
import {usdToCents,validateFriendDestination,quoteFriendPayment,FRIEND_RAILS} from "../src/lib/friend-payments.mjs";
const owner="6".repeat(44),dest="7".repeat(44);
test("dollar input is exact in cents",()=>{
 assert.equal(usdToCents("12.34"),1234);assert.equal(usdToCents("0.01"),1);
 assert.throws(()=>usdToCents("12.345"));assert.throws(()=>usdToCents("0"));
 assert.throws(()=>usdToCents("1e6"));assert.throws(()=>usdToCents("10000.01"));
});
test("never transfer to an unverified handle, phone or email",()=>{
 for(const raw of ["@alice","alice@example.com","+1 555 123 4567"]){
  assert.equal(quoteFriendPayment({recipient:raw,amount:"10.00",wallet:owner,verified:true}).ready,false);
 }
 assert.equal(validateFriendDestination(dest).kind,"wallet");
});
test("full wallet address still requires recipient confirmation",()=>{
 assert.equal(quoteFriendPayment({recipient:dest,amount:"10.00",wallet:owner}).ready,false);
 const q=quoteFriendPayment({recipient:dest,amount:"10.00",wallet:owner,verified:true});
 assert.equal(q.ready,true);assert.equal(q.asset,"USDC");assert.equal(q.usd,10);
});
test("reject wrong wallet, self-payment, unsafe notes and limits",()=>{
 assert.equal(quoteFriendPayment({recipient:dest,amount:"1",wallet:dest,verified:true}).ready,false);
 assert.equal(quoteFriendPayment({recipient:dest,amount:"100",wallet:owner,verified:true,limitUsd:50}).ready,false);
 assert.equal(quoteFriendPayment({recipient:dest,amount:"10",wallet:owner,verified:true,note:"a\nb"}).ready,false);
});
test("card, bank and handles do not masquerade as live rails",()=>{
 assert.equal(FRIEND_RAILS.filter(x=>x.status==="available").length,1);
 assert.ok(FRIEND_RAILS.find(x=>x.id==="card").status==="partner-required");
});
