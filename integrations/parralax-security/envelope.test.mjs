import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {sealEvidence,openEvidence} from "./envelope.mjs";
const key=randomBytes(32),other=randomBytes(32);
const input={tenantId:"tenantA",recordId:"receipt1",kind:"agent-audit",revision:1,keyId:"kms-2026-11",plaintext:"{\\\"decision\\\":\\\"DENY\\\"}"};
const expected={tenantId:input.tenantId,recordId:input.recordId,kind:input.kind,revision:1};
const keyring={[input.keyId]:key};
test("round-trip authenticated record",()=>{
 const envelope=sealEvidence(input,key);
 assert.equal(envelope.schema,"senda.sealed-evidence.v1");
 assert.equal(openEvidence(envelope,expected,keyring),input.plaintext);
 assert.ok(!JSON.stringify(envelope).includes(input.plaintext));
});
test("fresh 96-bit nonce per encryption",()=>{
 assert.notEqual(sealEvidence(input,key).nonce,sealEvidence(input,key).nonce);
});
test("rejects context swapping and incorrect master key",()=>{
 const e=sealEvidence(input,key);
 for(const patch of [{tenantId:"tenantB"},{recordId:"receipt2"},{kind:"trade-order"},{revision:2}]){
  assert.throws(()=>openEvidence(e,{...expected,...patch},keyring));
 }
 assert.throws(()=>openEvidence(e,expected,{[input.keyId]:other}));
});
test("rejects ciphertext and authentication tag modification",()=>{
 const e=sealEvidence(input,key);
 const bad=Buffer.from(e.ciphertext,"base64");bad[0]^=1;
 assert.throws(()=>openEvidence({...e,ciphertext:bad.toString("base64")},expected,keyring));
 const tag=Buffer.from(e.tag,"base64");tag[0]^=1;
 assert.throws(()=>openEvidence({...e,tag:tag.toString("base64")},expected,keyring));
});
test("fail closed on malformed inputs and oversized evidence",()=>{
 assert.throws(()=>sealEvidence({...input,plaintext:"x".repeat(131073)},key));
 assert.throws(()=>sealEvidence({...input,tenantId:"../escape"},key));
 assert.throws(()=>sealEvidence(input,randomBytes(16)));
});
