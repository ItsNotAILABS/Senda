import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const data=JSON.parse(readFileSync(new URL("./catalog.json",import.meta.url),"utf8"));
test("catalog has no live execution claims",()=>{
 assert.equal(data.schema,"senda.opensource.integration-catalog.v1");
 assert.ok(data.entries.length>=8);
 assert.ok(data.entries.every(item=>item.executionEnabled===false));
});
test("paused venues are excluded and high-copyleft code gated",()=>{
 const drift=data.entries.find(x=>x.id==="velocity-drift-lineage");
 assert.equal(drift.tier,"BLOCKED");
 assert.equal(drift.mode,"do-not-connect");
 const squads=data.entries.find(x=>x.id==="squads-v4");
 assert.equal(squads.license,"AGPL-3.0");
 assert.ok(squads.conditions.some(x=>x.includes("legal")));
});
test("unknown licenses never reported as verified",()=>{
 assert.ok(data.entries.every(item=>item.licenseChecked===true||/unverified|pending|specific|verify/i.test(item.license)));
});
