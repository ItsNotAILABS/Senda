import test from "node:test";
import assert from "node:assert/strict";
import {reviewAgentMoneyRequest} from "./agent-money-policy.mjs";
const a="11111111111111111111111111111112",b="11111111111111111111111111111113";
const c="11111111111111111111111111111114",mint="11111111111111111111111111111115";
const base=()=>({
 policy:{policyId:"policy:senda:00001",owner:a,agent:b,mint,
  network:"devnet",allowedRecipients:[c],perTxMinor:"2500000",
  dailyMinor:"5000000",lifetimeMinor:"20000000",expiresAt:5000000000},
 request:{requestId:"request:senda:0001",agent:b,recipient:c,mint,network:"devnet",amountMinor:"1000000"},
 state:{periodStartSec:3000000000,dailySpentMinor:"0",lifetimeSpentMinor:"0",
  pendingDailyMinor:"0",pendingLifetimeMinor:"0",recentRequestIds:[],nextNonce:7}
});
const nowSec=3000000100;
test("review does not grant execution authority even within budget",()=>{
 const x=reviewAgentMoneyRequest({...base(),nowSec});
 assert.equal(x.status,"review");assert.equal(x.canExecute,false);
 assert.equal(x.authority,"NONE");assert.equal(x.amountMinor,"1000000");
 assert.equal(x.requiresVerifiedTreasuryAccount,true);
});
test("blocked recipients, mismatched network, expired or paused policy deny",()=>{
 const cases=[
  x=>x.request.recipient=a,
  x=>x.request.network="mainnet-beta",
  x=>x.policy.expiresAt=1000,
  x=>x.state.paused=true
 ];
 for(const mutate of cases){const x=base();mutate(x);assert.equal(reviewAgentMoneyRequest({...x,nowSec}).status,"denied");}
});
test("minor unit precision and per transaction, daily and lifetime budgets",()=>{
 const x=base();
 x.request.amountMinor="1000001.12";
 assert.equal(reviewAgentMoneyRequest({...x,nowSec}).reason,"INVALID_AMOUNT_OR_COUNTER");
 const y=base();y.request.amountMinor="2500001";
 assert.equal(reviewAgentMoneyRequest({...y,nowSec}).reason,"PER_TX_LIMIT");
 const z=base();z.state.dailySpentMinor="4500000";
 assert.equal(reviewAgentMoneyRequest({...z,nowSec}).reason,"DAILY_LIMIT");
 const w=base();w.state.lifetimeSpentMinor="19500000";
 assert.equal(reviewAgentMoneyRequest({...w,nowSec}).reason,"LIFETIME_LIMIT");
});
test("replays, stale ledger periods, impossible nonce and invalid policy are refused",()=>{
 const x=base();x.state.recentRequestIds.push(x.request.requestId);
 assert.equal(reviewAgentMoneyRequest({...x,nowSec}).reason,"REQUEST_REPLAY");
 const y=base();y.state.periodStartSec=nowSec-86400;
 assert.equal(reviewAgentMoneyRequest({...y,nowSec}).reason,"LEDGER_STATE_UNVERIFIED");
 const z=base();z.state.nextNonce=-1;
 assert.equal(reviewAgentMoneyRequest({...z,nowSec}).reason,"UNVERIFIED_NONCE");
 const q=base();q.policy.dailyMinor="999";
 assert.equal(reviewAgentMoneyRequest({...q,nowSec}).reason,"INVALID_POLICY");
});
