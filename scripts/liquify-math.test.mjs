import test from "node:test";import assert from "node:assert/strict";
import {rawToUi,describeCurve,curveCoverage} from "../src/lib/liquify-math.mjs";
const rows=[
 {usd:5,status:"available",quote:{outAmount:"2500000",router:"metis",feeBps:5}},
 {usd:25,status:"available",quote:{outAmount:"10000000",router:"jupiterz",feeBps:5}},
 {usd:100,status:"unavailable",reason:"No route"},
 {usd:250,status:"unavailable",reason:"No liquidity"},
];
test("raw token amounts are converted exactly when decimals verified",()=>{
 assert.equal(rawToUi("12345678901234567890",9),"12345678901.23456789");
 assert.equal(rawToUi("1",6),"0.000001");
 assert.equal(rawToUi("10",0),"10");
 assert.equal(rawToUi("0",6),null);
 assert.equal(rawToUi("5000000",undefined),null);
});
test("quote size comparison reports price deterioration from actual quotes only",()=>{
 const out=describeCurve(rows,6);
 assert.equal(out[0].usdPerToken,2);assert.equal(out[0].executionPremiumPct,0);
 assert.equal(out[1].usdPerToken,2.5);assert.ok(Math.abs(out[1].executionPremiumPct-25)<0.0001);
 assert.equal(out[2].usdPerToken,null);assert.equal(out[2].executionPremiumPct,null);
 assert.equal(out[1].router,"jupiterz");
});
test("quote ladder coverage does not turn missing quotes into a fake book",()=>{
 const c=curveCoverage(rows);
 assert.deepEqual(c,{available:2,total:4,maxQuotedUsd:25,hasRoutableSize:true});
 assert.equal(curveCoverage([]).hasRoutableSize,false);
});
