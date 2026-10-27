import assert from "node:assert/strict";
import test from "node:test";
import {parseLine,summarizeReceipts,analyzeDay} from "./agent-learning-loop.mjs";
import {mkdtemp,mkdir,readFile,writeFile,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const day="2026-10-23";
test("parses only dated JSON receipts and hashes evidence",()=>{
 const row=parseLine(JSON.stringify({at:day+"T01:00:00Z",agentId:"scanner",message:"429 quote feed unavailable"}),day);
 assert.equal(row.hash.length,64);
 assert.equal(parseLine("not json",day),null);
 assert.equal(parseLine(JSON.stringify({at:"2026-10-22T00:00:00Z",message:"429"}),day),null);
});
test("no logs means no simulated self-improvement",()=>{
 const s=summarizeReceipts([],day);
 assert.equal(s.findings.length,0);assert.equal(s.promoted,0);assert.equal(s.executedTrades,0);
});
test("minimum evidence produces review-only skill proposals",()=>{
 const log=Array.from({length:3},(_,i)=>parseLine(JSON.stringify({at:day+"T01:00:00Z",agentId:"a",message:"429 rate limit",i}),day));
 const s=summarizeReceipts(log,day);
 assert.equal(s.findings.length,1);assert.equal(s.findings[0].id,"feed-resilience");
 assert.equal(s.findings[0].action,"proposal-only");
 assert.equal(s.findings[0].requiresHumanApproval,true);
});
test("processes real local JSONL log files with deterministic gates",async()=>{
 const root=await mkdtemp(path.join(tmpdir(),"senda-loop-"));
 const input=path.join(root,"logs"),output=path.join(root,"out");
 await mkdir(input);
 await writeFile(path.join(input,"agents.jsonl"),[
  ...Array.from({length:3},(_,i)=>JSON.stringify({at:day+"T01:00:00Z",agentId:"x",message:"volume unavailable",i})),
  JSON.stringify({at:"2026-10-22T12:00:00Z",message:"volume unavailable"}),
 ].join("\n"));
 const s=await analyzeDay({date:day,inputDir:input,outputDir:output});
 assert.equal(s.read,3);assert.equal(s.findings[0].id,"volume-quality");
 assert.match(await readFile(path.join(output,day,"PROPOSED_SKILLS.md"),"utf8"),/NOT APPROVED/);
 assert.ok((await readdir(path.join(output,day))).includes("report.json"));
});
