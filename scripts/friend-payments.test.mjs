import test from "node:test";import assert from "node:assert/strict";
import {usdToCents,validateFriendDestination,quoteFriendPayment,buildFriendPayment,FRIEND_RAILS,DEFAULT_FRIEND_MEMO} from "../src/lib/friend-payments.mjs";
const owner="6".repeat(44),dest="7".repeat(44);
const base={recipient:dest,wallet:owner,verified:true,limitUsd:100};
test("dollar input is exact in cents",()=>{
 assert.equal(usdToCents("12.34"),1234);assert.equal(usdToCents("0.01"),1);assert.equal(usdToCents("0.29"),29);
 assert.throws(()=>usdToCents("12.345"));assert.throws(()=>usdToCents("0"));
 assert.throws(()=>usdToCents("1e6"));assert.throws(()=>usdToCents("10000.01"));
});
test("never transfer to an unverified handle, phone or email",()=>{
 for(const raw of ["@alice","alice@example.com","+1 555 123 4567"]){
  assert.equal(quoteFriendPayment({...base,recipient:raw,amount:"10.00"}).ready,false);
 }
 assert.equal(validateFriendDestination(dest).kind,"wallet");
});
test("full wallet address still requires recipient confirmation",()=>{
 assert.equal(quoteFriendPayment({...base,verified:false,amount:"10.00"}).ready,false);
 const q=quoteFriendPayment({...base,amount:"10.00"});
 assert.equal(q.ready,true);assert.equal(q.asset,"USDC");assert.equal(q.cents,1000);
});
test("reject wrong wallet, self-payment, unsafe notes",()=>{
 assert.equal(quoteFriendPayment({...base,amount:"1",wallet:dest}).ready,false);
 assert.equal(quoteFriendPayment({...base,amount:"10",note:"a\nb"}).ready,false);
});
test("quote enforces the wallet's real per-send cap, not a hard-coded default",()=>{
 const over=quoteFriendPayment({...base,amount:"100.01",limitUsd:100});
 assert.equal(over.ready,false);assert.match(over.reason,/\$100\.00 per-send cap/);
 assert.equal(quoteFriendPayment({...base,amount:"100.00",limitUsd:100}).ready,true);
 assert.equal(quoteFriendPayment({...base,amount:"2500",limitUsd:5000}).ready,true);
 // A missing cap fails closed instead of silently allowing $1,000.
 const {limitUsd,...noCap}=base;
 assert.equal(quoteFriendPayment({...noCap,amount:"5"}).ready,false);
});
test("payment input carries integer cents and the note as the on-chain memo",()=>{
 const q=quoteFriendPayment({...base,amount:"12.34",note:"  dinner  "});
 assert.deepEqual(buildFriendPayment(q),{owner,to:dest,cents:1234,memo:"dinner"});
 assert.ok(Number.isSafeInteger(buildFriendPayment(q).cents));
 const plain=quoteFriendPayment({...base,amount:"5"});
 assert.equal(buildFriendPayment(plain).memo,DEFAULT_FRIEND_MEMO);
 assert.throws(()=>buildFriendPayment(quoteFriendPayment({...base,verified:false,amount:"5"})));
});
test("card, bank and handles do not masquerade as live rails",()=>{
 assert.equal(FRIEND_RAILS.filter(x=>x.status==="available").length,1);
 assert.ok(FRIEND_RAILS.find(x=>x.id==="card").status==="partner-required");
});
