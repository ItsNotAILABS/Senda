import test from "node:test";import assert from "node:assert/strict";
import {normalizeEventBook,planEventSide,evaluateEventProduct,eventMarketUrl,EVENT_TEMPLATES} from "../src/lib/event-contract-router.mjs";
const now=1800000000000;
const sample={orderbook_fp:{yes_dollars:[["0.5500","5.00"],["0.5100","15.00"]],
 no_dollars:[["0.6000","3.00"],["0.5000","10.00"]]}};
const book=normalizeEventBook("KXRAIN-26NOV03-A",sample,now);
test("uses real opposite-side bids, never synthetic asks",()=>{
 const p=planEventSide(book,"yes",5,now+1000);
 assert.equal(p.available,true);assert.equal(p.grossCostUsd,2.2);
 assert.equal(p.maximumPayoutUsd,5);assert.equal(p.fees,"unknown");
 assert.equal(planEventSide(book,"no",3,now+1000).grossCostUsd,1.35);
});
test("refuses greater size than observed depth",()=>{
 const p=planEventSide(book,"yes",20,now+1000);assert.equal(p.available,false);assert.equal(p.filled,13);
});
test("staleness is fail closed",()=>assert.equal(planEventSide(book,"yes",1,now+31000).available,false));
test("missing book is unavailable, not a fictional probability",()=>{
 const missing=normalizeEventBook("KXRAIN-26NOV03-A",{},now);
 assert.equal(planEventSide(missing,"yes",1,now+1000).available,false);
});
test("malformed prices, zero and sizes rejected",()=>{
 const invalid=normalizeEventBook("KXRAIN-26NOV03-A",{orderbook_fp:{yes_dollars:[["abc","10.00"],["0.0000","3.00"],["0.5000","0.00"],["0.4900","5.00"]]}},now);
 assert.equal(invalid.yesBids.length,1);
});
test("research budget denies overrun before fees",()=>{
 assert.equal(evaluateEventProduct({templateId:"weather",book,side:"yes",contracts:5,budgetUsd:1,now:now+1000}).ready,false);
 const good=evaluateEventProduct({templateId:"weather",book,side:"yes",contracts:5,budgetUsd:10,now:now+1000});
 assert.equal(good.ready,true);assert.equal(good.execution,"disabled");assert.equal(good.quote.notExecutable,true);
});
test("five product templates never become an insurance claim",()=>{
 assert.equal(EVENT_TEMPLATES.length,5);
 assert.ok(EVENT_TEMPLATES.find(x=>x.id==="weather").caution.includes("Not insurance"));
});
test("safe links use restricted ticker shape",()=>{
 assert.equal(eventMarketUrl("../admin"),null);
 assert.equal(eventMarketUrl("KXRAIN-26NOV03-A"),"https://kalshi.com/markets/kxrain-26nov03-a");
});
