import test from "node:test";import assert from "node:assert/strict";
import {classifyMarket,marketSpread,selectMarkets,MARKET_LANES} from "../src/lib/event-market-discovery.mjs";
import {contingencyScenario,contingencyReservePlan,CONTINGENCY_USE_CASES} from "../src/lib/contingency-analysis.mjs";
const now=1800000000000;
const quote={available:true,notExecutable:true,quotedAt:now,contracts:10,grossCostUsd:3.5,maximumPayoutUsd:10};
test("category navigation never invents official venue categories",()=>{
 assert.equal(classifyMarket({title:"Will Bitcoin reach $100,000?"}),"crypto");
 assert.equal(classifyMarket({title:"Will the Fed change the interest rate?"}),"economy");
 assert.equal(classifyMarket({title:"Unrelated uncertain event"}),"other");
 assert.equal(MARKET_LANES.length,8);
});
test("sort and spread are deterministic, missing asks are not zero",()=>{
 const a={ticker:"FOO",title:"Football final",vol:500,bid:0.4,ask:0.44,close:"2033-01-01"};
 const b={ticker:"BTC",title:"Bitcoin price",vol:600,bid:null,ask:null,close:"2034-01-01"};
 assert.equal(marketSpread(b),null);
 assert.equal(marketSpread(a),4);
 assert.equal(selectMarkets([a,b],{lane:"sports"}).length,1);
 assert.equal(selectMarkets([a,b],{sort:"tight-spread"})[0].ticker,"FOO");
 assert.equal(selectMarkets([a,b],{sort:"closing"})[0].ticker,"FOO");
});
test("four independent event/loss outcomes, no insurance",()=>{
 const r=contingencyScenario({quote,possibleLossUsd:1000,budgetUsd:20,marketTicker:"KXRAIN-26NOV03-A",now:now+500});
 assert.equal(r.ready,true);assert.equal(r.insurance,false);assert.equal(r.execution,"disabled");
 assert.equal(r.events.length,4);
 assert.equal(r.events[0].overallNetBeforeFees,-993.5);
 assert.equal(r.events[1].overallNetBeforeFees,6.5);
 assert.equal(r.events[2].overallNetBeforeFees,-1003.5);
 assert.equal(r.feesKnown,false);assert.equal(r.quoteExecutable,false);
});
test("budget, staleness, missing depth and invented claims fail closed",()=>{
 const valid={quote,possibleLossUsd:1000,budgetUsd:20,marketTicker:"KXRAIN-26NOV03-A",now:now+500};
 assert.equal(contingencyScenario({...valid,budgetUsd:3}).ready,false);
 assert.equal(contingencyScenario({...valid,now:now+30001}).ready,false);
 assert.equal(contingencyScenario({...valid,quote:null}).ready,false);
 assert.equal(contingencyScenario({...valid,quote:{...quote,notExecutable:false}}).ready,false);
 assert.equal(contingencyScenario({...valid,quote:{...quote,grossCostUsd:NaN}}).ready,false);
 assert.equal(contingencyScenario({...valid,marketTicker:"../bad"}).ready,false);
});
test("scenario products remain explicitly non-insurance",()=>{
 assert.equal(CONTINGENCY_USE_CASES.length,5);
 assert.ok(CONTINGENCY_USE_CASES.every(x=>x.caution&&x.detail));
});

test("chosen NO side properly inverts settlement outcomes",()=>{
 const r=contingencyScenario({quote:{...quote,side:"no"},possibleLossUsd:1000,budgetUsd:20,marketTicker:"KXRAIN-26NOV03-A",now:now+1000});
 assert.equal(r.ready,true);assert.equal(r.chosenSide,"no");
 assert.equal(r.events[0].marketResolves,"no");assert.equal(r.events[2].marketResolves,"yes");
});
test("cash reserve planning never assumes a market payout",()=>{
 const p=contingencyReservePlan({potentialExpenseUsd:1000,availableCashUsd:150,targetCoveragePct:60});
 assert.equal(p.ready,true);assert.equal(p.targetCashReserveUsd,600);
 assert.equal(p.additionalCashRequiredUsd,450);assert.equal(p.insurance,false);
 assert.equal(contingencyReservePlan({potentialExpenseUsd:-1}).ready,false);
});
