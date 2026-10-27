#!/usr/bin/env node
/** A governed periodic discovery probe. No trades, mints, wallet or financial execution. */
import { readFile,writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root=new URL("../",import.meta.url);
const config=JSON.parse(await readFile(new URL("config/solana-ecosystem-scout.json",root),"utf8"));
if(config.schema!=="senda.ecosystem.scout.v1"||!Array.isArray(config.candidates))throw Error("Invalid scout registry");
const id=/^[a-z][a-z0-9-]{2,60}$/;
const allowed=new Set(["https:"]);
const rows=[];
for(const c of config.candidates){
 if(!id.test(c.id)||typeof c.name!=="string"||!c.reason)throw Error("Invalid candidate");
 const url=new URL(c.url);
 if(!allowed.has(url.protocol)||url.username||url.password)throw Error("Non-HTTPS discovery source");
 let status="unavailable",code=null;
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6500);
  try{
   const response=await fetch(url,{method:"GET",redirect:"follow",signal:controller.signal,headers:{"user-agent":"Senda-Ecosystem-Scout/1.0"}});
   code=response.status;
   status=response.ok?"reachable":"http-error";
  }finally{clearTimeout(timeout);}
 }catch{status="unavailable";}
 rows.push({id:c.id,name:c.name,lane:c.lane,priority:c.priority,source:c.url,status,httpCode:code,
  disposition:c.integration,approval:c.approval});
}
const digest=createHash("sha256").update(JSON.stringify(rows)).digest("hex");
const report={schema:"senda.scout.report.v1",observedAt:new Date().toISOString(),
 digest,verifiedIntegrations:0,notes:"Source reachability is NOT an endorsement, integration or real liquidity. Manual vetting required.",rows};
const dest=process.argv.find(v=>v.startsWith("--out="))?.slice(6)||"solana-scout-report.json";
await writeFile(dest,JSON.stringify(report,null,2)+"\n");
process.stdout.write("Scouted "+rows.length+" registered sources; "+rows.filter(x=>x.status==="reachable").length+" reachable. No integrations activated.\n");
