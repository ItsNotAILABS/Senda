import test from "node:test";import assert from "node:assert/strict";
import {mkdtemp,readFile} from "node:fs/promises";import {tmpdir} from "node:os";import path from "node:path";
import {buildGenesisMetadata,releaseRecord} from "./genesis-build-metadata.mjs";
import {findAsset} from "../src/lib/genesis-catalog.mjs";
test("Raven metadata points to its specific illustrated card",()=>{
 const entry=releaseRecord(findAsset("sen"),"https://senda.pocketnova.app");
 assert.match(entry.metadata.image,/cards\/sen.svg$/);
 assert.equal(entry.mint,null);
});
test("gear and code assets have distinct metadata paths",()=>{
 assert.match(releaseRecord(findAsset("raven-wing"),"https://senda.pocketnova.app").metadata.image,/gear\/raven-wing.svg$/);
 assert.match(releaseRecord(findAsset("signal-matrix"),"https://senda.pocketnova.app").metadata.image,/code\/signal-matrix.svg$/);
});
test("all 18 blueprints are generated without fake mints",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"senda-genesis-"));
 const m=await buildGenesisMetadata({directory:dir});
 assert.equal(m.assets.length,18);assert.equal(m.status,"NOT_MINTED");
 const raven=JSON.parse(await readFile(path.join(dir,"sen.json"),"utf8"));
 assert.equal(raven.name.includes("SEN"),true);
 assert.equal(m.assets.every(x=>x.status==="unminted-blueprint"&&x.mint===null&&x.sha256.length===64),true);
});
