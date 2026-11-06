import test from "node:test";import assert from "node:assert/strict";
import {usdToCents,normalizeFriend,planFriendPayment,payoutStage,friendInviteLink,sanitizePaymentNote} from "../src/lib/friend-money.mjs";
const owner="6".repeat(44),address="7".repeat(44),friend=normalizeFriend({name:"A friend",address,tag:"@friend"});
test("money values use exact cents, not floats",()=>{assert.equal(usdToCents("0.01"),1);assert.equal(usdToCents("10.25"),1025);assert.throws(()=>usdToCents("1.234"));assert.throws(()=>usdToCents("0"));});
test("no invisible fiat conversion or deposit is invented",()=>{
 for(const method of ["bank","debit-card"])assert.equal(planFriendPayment({friend,amount:"5",owner,capUsd:100,method}).ready,false);
 for(const payout of ["bank","debit-card"])assert.equal(planFriendPayment({friend,amount:"5",owner,capUsd:100,payout}).kind,"provider-required");
});
test("wallet sends are allowed only to explicit reviewed destinations",()=>{
 const good=planFriendPayment({friend,amount:"5.50",owner,capUsd:100});assert.equal(good.ready,true);assert.equal(good.amountCents,550);
 assert.equal(planFriendPayment({friend:{...friend,address:owner},amount:"5",owner,capUsd:100}).ready,false);
 assert.equal(planFriendPayment({friend,amount:"200",owner,capUsd:100}).kind,"over-limit");
});
test("local handles are not globally authenticated identities",()=>{assert.equal(friend.verified,false);assert.throws(()=>normalizeFriend({name:"A",address:"fake"}));});
test("only independently confirmed settlement can look paid",()=>{
 assert.equal(payoutStage({rail:"solana-usdc",chainConfirmation:"pending",signature:"8".repeat(88)}).paid,false);
 assert.equal(payoutStage({bankSettlement:"completed"}).paid,false);
 assert.equal(payoutStage({rail:"solana-usdc",chainConfirmation:"confirmed",signature:"8".repeat(88)}).paid,true);
});
test("share link carries a destination but not authorization",()=>{
 const u=new URL(friendInviteLink({address,name:"Friend"}));assert.equal(u.searchParams.get("to"),address);assert.equal(u.origin,"https://senda.pocketnova.app");
 assert.equal(sanitizePaymentNote("Lunch\nprivate"),"Lunch private");
});
