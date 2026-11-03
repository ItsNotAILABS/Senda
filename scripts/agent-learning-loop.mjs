#!/usr/bin/env node
/** Deterministic overnight improvement proposals; never applies, installs, or signs anything. */
import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const classes=[
 {id:"feed-resilience",re:/\b(429|rate.limit|timeout|feed unavailable|source error)\b/i,remedy:"Bounded quote/candle retries with provenance and circuit breaking",test:"Replay 429, missing data, empty pool candles, and stale sources"},
 {id:"wallet-recovery",re:/\b(unconfirmed|transaction timeout|reconciliation|signature status|blockhash expired)\b/i,remedy:"Verified, idempotent transaction recovery across restarts",test:"Test pending signatures, delayed finality and cross-session duplicate prevention"},
 {id:"volume-quality",re:/\b(volume unavailable|no traded volume|zero volume|volume mismatch|stale volume)\b/i,remedy:"Strict pool-volume validation and source fallback gating",test:"Assert no volume-dependent signal without genuine USD OHLCV"},
 {id:"agent-boundaries",re:/\b(unauthoriz|budget exceeded|queue invalid|scope violation|wallet rejected|signing without)\b/i,remedy:"Narrow agent capabilities and enforce execution-budget invariants",test:"Test refused scopes, replayed queue, budget caps and required approval"},
];
export function summarizeReceipts(records,date) {
 const counted=classes.map(c=>({...c,matches:records.filter(r=>c.re.test(r.message))}));
 const findings=counted.filter(c=>c.matches.length>=3).map(c=>({
   id:c.id,occurrences:c.matches.length,action:"proposal-only",remedy:c.remedy,
   acceptanceTest:c.test,verified:false,requiresHumanApproval:true,
   evidence:c.matches.slice(0,8).map(r=>({at:r.at,agentId:r.agentId,hash:r.hash})),
 }));
 return {schema:"senda.learning.v1",date,read:records.length,promoted:0,executedTrades:0,
   generatedAt:new Date().toISOString(),findings,
   note:records.length?"Evidence-based proposals only. No code changes or skill installations.":"No exported agent logs for the date. Do not claim autonomous learning."};
}
export function parseLine(line,date) {
 let row;
 try {row=JSON.parse(line);}catch{return null;}
 if(!row||typeof row!=="object"||typeof row.at!=="string"||!row.at.startsWith(date)||typeof row.message!=="string")return null;
 const message=row.message.slice(0,1000);
 const agentId=String(row.agentId??"unknown").slice(0,80);
 const hash=createHash("sha256").update(line).digest("hex");
 return {at:row.at.slice(0,30),agentId,message,hash};
}
export async function analyzeDay({date,inputDir="ops/agent-logs",outputDir="artifacts/skill-proposals"}) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Require a YYYY-MM-DD date.");
 let files=[];
 try {files=(await readdir(inputDir)).filter(name=>name.endsWith(".jsonl")&&!name.includes("..")).slice(0,40);}catch(e){if(e.code!=="ENOENT")throw e;}
 const receipts=[];
 for(const filename of files) {
   const raw=await readFile(path.join(inputDir,filename),"utf8");
   if(raw.length>4_000_000)throw Error("Refusing oversized logs; split them first.");
   for(const line of raw.split(/\r?\n/).slice(0,5000)) {
     if(!line.trim())continue;
     const v=parseLine(line,date);
     if(v)receipts.push(v);
   }
 }
 const report=summarizeReceipts(receipts,date);
 const dir=path.join(outputDir,date);
 await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,"report.json"),JSON.stringify(report,null,2)+"\n");
 if(report.findings.length) {
   const content=[
    "# Senda proposed reusable improvements — "+date,
    "",
    "NOT APPROVED. Evidence is from exported browser agent receipts, not a production execution ledger.",
    "Never install a skill, execute orders, deploy, or change source from this report automatically.",
    ...report.findings.flatMap(f=>["","## "+f.id,"Occurrences: "+f.occurrences,"Recommended change: "+f.remedy,
      "Acceptance test: "+f.acceptanceTest,"Status: proposal-only; requires human review and test evidence."]),
    "",
   ].join("\n");
   await writeFile(path.join(dir,"PROPOSED_SKILLS.md"),content);
 }
 return report;
}
if(process.argv[1] && import.meta.url===new URL("file://"+path.resolve(process.argv[1])).href) {
 const dateArg=process.argv.find(a=>a.startsWith("--date="));
 const day=dateArg?.slice(7)||new Date(Date.now()-86400000).toISOString().slice(0,10);
 analyzeDay({date:day,inputDir:process.env.SENDA_AGENT_LOG_DIR||"ops/agent-logs",
   outputDir:process.env.SENDA_SKILL_REPORT_DIR||"artifacts/skill-proposals"})
   .then(report=>{process.stdout.write(JSON.stringify({date:day,read:report.read,candidates:report.findings.length})+"\n");})
   .catch(error=>{process.stderr.write(String(error)+"\n");process.exitCode=1;});
}
