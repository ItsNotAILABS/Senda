import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('all registered venues have unique ids, official HTTPS links and declared approval',async()=>{
 const config=JSON.parse(await readFile(new URL('../config/solana-ecosystem-scout.json',import.meta.url),'utf8'));
 assert.equal(config.schema,'senda.ecosystem.scout.v1');
 const ids=new Set();
 for(const c of config.candidates){
  assert.ok(!ids.has(c.id));ids.add(c.id);
  assert.equal(new URL(c.url).protocol,'https:');
  assert.ok(c.approval&&c.reason&&c.integration);
 }
 assert.ok(ids.size>=7);
});
