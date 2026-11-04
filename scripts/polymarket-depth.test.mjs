import test from "node:test";import assert from "node:assert/strict";
import {normalizePolymarketDepth,planPolymarketBuy} from "../src/lib/polymarket-depth.mjs";
const now=1800000000000,id="123456789012345678901234567890",raw={asset_id:id,timestamp:"1800000000",bids:[{price:"0.40",size:"10"},{price:"0.45",size:"5"}],
asks:[{price:"0.60",size:"10"},{price:"0.55",size:"3"}]};
test("ask depth sorted by best executable ask, not arbitrary provider array order",()=>{
 const book=normalizePolymarketDepth(id,raw,now);
 assert.equal(book.bestAsk,.55);assert.equal(book.bestBid,.45);
 const estimate=planPolymarketBuy(book,5,now+1000);
 assert.equal(estimate.available,true);
 assert.equal(estimate.grossCostUsd,2.85);
 assert.equal(estimate.notExecutable,true);
});
test("no source quote for nonexistent or mismatched outcome token",()=>{
 assert.throws(()=>normalizePolymarketDepth(id,{...raw,asset_id:"999999999999999999999999999999"},now));
 assert.equal(planPolymarketBuy(normalizePolymarketDepth(id,{asset_id:id,bids:[],asks:[]},now),1,now).available,false);
});
test("fail closed on stale or short CLOB depth",()=>{
 const book=normalizePolymarketDepth(id,raw,now);
 assert.equal(planPolymarketBuy(book,50,now).available,false);
 assert.equal(planPolymarketBuy(book,1,now+31000).available,false);
});

test("source exchange timestamp missing or stale cannot be quoted",()=>{
 const absent=normalizePolymarketDepth(id,{...raw,timestamp:undefined},now);
 assert.equal(planPolymarketBuy(absent,5,now).available,false);
 const lag=normalizePolymarketDepth(id,{...raw,timestamp:"1799999000"},now);
 assert.equal(planPolymarketBuy(lag,5,now).available,false);
});
