import test from "node:test";import assert from "node:assert/strict";
import {centsToUsdcRaw,centsToDecimalString,usdNumberToCents,assertCents} from "../src/lib/usdc-amount.mjs";
test("cents become USDC base units with BigInt math only",()=>{
 assert.equal(centsToUsdcRaw(1),10_000n);
 assert.equal(centsToUsdcRaw(29),290_000n);
 assert.equal(centsToUsdcRaw(1_000_000),10_000_000_000n);
 // Every cent value maps exactly (no float drift anywhere in range).
 for(let c=1;c<=100_000;c+=7) assert.equal(centsToUsdcRaw(c),BigInt(c)*10_000n);
});
test("decimal strings are exact",()=>{
 assert.equal(centsToDecimalString(1),"0.01");
 assert.equal(centsToDecimalString(1234),"12.34");
 assert.equal(centsToDecimalString(100),"1.00");
});
test("legacy dollar numbers round once to cents and are bounded",()=>{
 assert.equal(usdNumberToCents(0.29),29);assert.equal(usdNumberToCents(1.1),110);
 for(const bad of [0,-1,NaN,Infinity,10_000.01]) assert.throws(()=>usdNumberToCents(bad));
 for(const bad of [0,1.5,1_000_001]) assert.throws(()=>assertCents(bad));
});
