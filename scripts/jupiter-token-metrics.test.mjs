import test from "node:test";import assert from "node:assert/strict";
import {readJupiterTokenMetrics} from "../src/lib/jupiter-token-metrics.mjs";
test("preserves actual Jupiter percent-point semantics and adds buy/sell USD volume",()=>{
 const m=readJupiterTokenMetrics({usdPrice:145.47,liquidity:500000,organicScore:98.9,isVerified:true,
  updatedAt:"2026-10-26T18:00:00Z",stats24h:{priceChange:1.507636,buyVolume:1200,sellVolume:800}});
 assert.equal(m.priceChangePct,1.507636);assert.equal(m.volume24hUsd,2000);assert.equal(m.verified,true);
});
test("absence of one reported volume side cannot be replaced with zero",()=>{
 const m=readJupiterTokenMetrics({stats24h:{buyVolume:100}});
 assert.equal(m.volume24hUsd,null);assert.equal(m.priceUsd,null);assert.equal(m.liquidityUsd,null);
});
test("rejects invalid, negative and fabricated organic metrics",()=>{
 assert.equal(readJupiterTokenMetrics(null),null);
 const m=readJupiterTokenMetrics({usdPrice:-10,liquidity:-100,organicScore:150,
  updatedAt:"not-a-date",stats24h:{priceChange:NaN,buyVolume:Infinity,sellVolume:-2}});
 assert.equal(m.priceUsd,null);assert.equal(m.volume24hUsd,null);assert.equal(m.organicScore,null);assert.equal(m.updatedAt,null);
});
