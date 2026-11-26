import test from "node:test";import assert from "node:assert/strict";
import {normalizeKalshiCandles,HISTORY_WINDOWS} from "../src/lib/kalshi-history-core.mjs";
const first=1800000000;
test("real prices, volumes and open interest remain separate",()=>{
 const rows=[{end_period_ts:first,price:{close_dollars:"0.5600"},volume_fp:"9.00",open_interest_fp:"11.00"}];
 const bars=normalizeKalshiCandles(rows,{from:first-3600,to:first+3600});
 assert.equal(bars[0].priceUsd,.56);assert.equal(bars[0].volumeContracts,9);
 assert.equal(bars[0].openInterestContracts,11);
});
test("missing values never turn into painted fake bars",()=>{
 const rows=[{end_period_ts:first,price:{close_dollars:null},volume_fp:null,open_interest_fp:null},
 {end_period_ts:first+60,price:{close_dollars:"not-real"},volume_fp:"",open_interest_fp:undefined}];
 const out=normalizeKalshiCandles(rows,{from:first-1,to:first+61});
 assert.equal(out.length,2);assert.equal(out[0].priceUsd,null);
 assert.equal(out[0].volumeContracts,null);assert.equal(out[1].volumeContracts,null);
});
test("zero reported volume is distinct from unreported volume",()=>{
 const out=normalizeKalshiCandles([{end_period_ts:first,volume_fp:"0"}],{from:first-1,to:first+1});
 assert.equal(out[0].volumeContracts,0);
});
test("candles sort and dedupe, reject future and malformed timestamps",()=>{
 const raw=[{end_period_ts:first+3600},{end_period_ts:first},{end_period_ts:first},{end_period_ts:0},{end_period_ts:first+900000}];
 const out=normalizeKalshiCandles(raw,{from:first-10,to:first+4000});
 assert.deepEqual(out.map(x=>x.time),[first,first+3600]);
});
test("hour/day windows honor Kalshi endpoint documented intervals",()=>{
 assert.deepEqual(HISTORY_WINDOWS.map(x=>x.interval),[60,60,1440]);
});
