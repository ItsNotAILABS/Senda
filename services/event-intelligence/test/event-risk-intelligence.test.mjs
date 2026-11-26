import test from "node:test";
import assert from "node:assert/strict";
import {analyzeEventEvidence} from "../src/event-risk-intelligence.mjs";
import {createEventService} from "../src/service.mjs";

const now=Date.parse("2026-11-26T20:00:00Z"),ticker="KXRAIN-26DEC01-A";
const detail={ticker,status:"active",rulesPrimary:"Official weather source",
 closeTime:"2026-12-01T00:00:00Z",volume24hContracts:220};
const book={ticker,asOf:now-1000,yesBids:[{bid:4100,size:12}],noBids:[{bid:5700,size:9}]};
const history={ticker,window:"24h",bars:[{time:Math.floor(now/1000)-3600,priceUsd:.41,
 volumeContracts:10},{time:Math.floor(now/1000),priceUsd:.44,volumeContracts:5}]};
test("source-consistent active book and history yield research-quality evidence, never execution",()=>{
 const x=analyzeEventEvidence({detail,book,history,now});
 assert.equal(x.researchReady,true);assert.equal(x.quality,"complete");
 assert.equal(x.market.yesBestBidUsd,.41);assert.equal(x.market.yesImpliedAskUsd,.43);
 assert.equal(x.market.spreadUsd,.02);assert.equal(x.market.noBidDepthContracts,9);
 assert.equal(x.execution,"disabled");assert.equal(x.insurance,false);
 assert.equal(x.tradeRecommendation,null);
});
test("expired book, crossed book and expired market are blocked",()=>{
 const x=analyzeEventEvidence({detail:{...detail,closeTime:"2026-11-25T00:00:00Z"},
  book:{...book,asOf:now-40000,noBids:[{bid:6000,size:1}]},history,now});
 assert.equal(x.researchReady,false);assert.ok(x.flags.includes("BOOK_NOT_FRESH"));
 assert.ok(x.flags.includes("CROSSED_OR_INCONSISTENT_BOOK"));
 assert.ok(x.flags.includes("MARKET_CLOSE_PASSED"));
});
test("missing history and missing book levels are explicit, not invented",()=>{
 const x=analyzeEventEvidence({detail,book:{...book,noBids:[]},history:{ticker,window:"24h",bars:[]},now});
 assert.equal(x.researchReady,false);assert.equal(x.market.yesImpliedAskUsd,null);
 assert.equal(x.market.lastReportedPriceUsd,null);
 assert.ok(x.flags.includes("INCOMPLETE_TWO_SIDED_BOOK"));
 assert.ok(x.flags.includes("RECENT_PRICE_MISSING"));
});
test("mismatched source tickers fail closed",()=>{
 assert.throws(()=>analyzeEventEvidence({detail,book:{...book,ticker:"KXFAKE-ABC"},history,now}),/identifiers/);
});
test("authenticated intelligence endpoint returns observed research-only envelope",async()=>{
 const key="server-test-key-for-intelligence-0123456789";
 const facts={
  events:[],market:{market:{ticker,status:"active",rules_primary:"Rules",
   close_time:"2026-12-01T00:00:00Z",series_ticker:"KXRAIN"}},
  book:{orderbook_fp:{yes_dollars:[["0.4100","12.00"]],no_dollars:[["0.5700","9.00"]]}},
  candles:{ticker,candlesticks:[{end_period_ts:Math.floor(now/1000),price:{close_dollars:".4400"},
   volume_fp:"10.00",open_interest_fp:"20.00"}]}
 };
 const fakeFetch=async url=>{
  const s=new URL(url).pathname;const value=s.endsWith("/orderbook")?facts.book:
   s.endsWith("/candlesticks")?facts.candles:
   s.endsWith("/markets/"+ticker)?facts.market:null;
  return value?new Response(JSON.stringify(value),{status:200}):
   new Response("not found",{status:404});
 };
 const api=createEventService({env:{SENDA_EVENT_API_KEYS:key},fetchImpl:fakeFetch,now:()=>now});
 const request=(auth=true)=>new Request("https://senda.internal/v1/intelligence/"+ticker+"?window=24h",{
  headers:auth?{authorization:"Bearer "+key}:{}
 });
 assert.equal((await api.handleRequest(request(false))).status,401);
 const res=await api.handleRequest(request());
 assert.equal(res.status,200);const body=await res.json();
 assert.equal(body.execution,"disabled");assert.equal(body.insurance,false);
 assert.equal(body.data.schema,"senda.events.intelligence.v1");
 assert.equal(body.data.researchReady,true);
 assert.equal(body.receipt.durable,false);
});
