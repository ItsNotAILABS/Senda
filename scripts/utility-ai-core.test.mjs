import test from "node:test";import assert from "node:assert/strict";
import {SOL_USDC,normalizePrestock,normalizePools,buildUtilityReport,validateModelCommentary} from "../src/lib/utility-ai-core.mjs";
const mint="7".repeat(44),addr="8".repeat(44),now="2026-10-28T12:00:00.000Z";
const seed=[{contract_address:mint,name:"Example economic token",symbol:"TEST",tokenPrice:12,markPrice:10,holders:120}];
const pool={data:[{attributes:{address:addr,name:"Example pool",reserve_in_usd:"19000",volume_usd:{h24:"5000"},transactions:{h24:{buys:12,sells:5}}}}]};
test("requires matching live provider mint without fallback",()=>{
 assert.equal(normalizePrestock(seed,"9".repeat(44)),null);
 assert.equal(normalizePrestock(seed,mint)?.tokenPrice,12);
 assert.equal(normalizePrestock([{...seed[0],tokenPrice:"not-a-price"}],mint)?.tokenPrice,null);
});
test("does not fabricate unavailable volumes or pools",()=>{
 assert.deepEqual(normalizePools({data:[]},mint),[]);
 const p=normalizePools({data:[{attributes:{address:addr,reserve_in_usd:null}}]},mint)[0];
 assert.equal(p.reserveUsd,null);assert.equal(p.volume24Usd,null);
});
test("financial evidence cites source and does not claim a fill",()=>{
 const report=buildUtilityReport({task:"market",mint,prestock:normalizePrestock(seed,mint),pools:normalizePools(pool,mint),now});
 assert.equal(report.facts.find(x=>x.id==="premium")?.value,20);
 assert.equal(report.facts.find(x=>x.id==="pool_reserve")?.value,19000);
 assert.equal(report.authority,"read-only");
 assert.ok(report.risks.some(x=>x.includes("not executable")));
});
test("transfer guard refuses extreme or invalid amount and no signing",()=>{
 assert.throws(()=>buildUtilityReport({task:"transfer",currency:"USDC",amount:100001}));
 assert.throws(()=>buildUtilityReport({task:"transfer",currency:"SOL",amount:1}));
 const report=buildUtilityReport({task:"transfer",currency:"USDC",amount:50});
 assert.equal(report.facts.find(x=>x.id==="mint")?.value,SOL_USDC);
 assert.ok(report.risks.some(x=>x.includes("No transaction")));
});
test("LLM commentary must reference observed facts only",()=>{
 const message={summary:"Market research",observations:[{text:"A pool",evidence_ids:["pool_reserve"]}],uncertainties:["Not a quote"],next_steps:["Check quote"]};
 assert.equal(validateModelCommentary(message,["pool_reserve"]).observations.length,1);
 assert.throws(()=>validateModelCommentary({...message,observations:[{text:"Invented",evidence_ids:["not_a_source"]}]},["pool_reserve"]));
});
