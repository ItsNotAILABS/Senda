import test from "node:test";
import assert from "node:assert/strict";
import {minorUnits,treasuryProposal,machinePaymentReceiptDraft,provenanceCommitment} from "./treasury-intent.mjs";
const a="So11111111111111111111111111111111111111112";
const b="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const c="3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh";
test("exact decimal bigint units",()=>{
 assert.equal(minorUnits("0.000001",6),"1");
 assert.equal(minorUnits("1.0000001",6),null);
 assert.equal(minorUnits("1e3",6),null);
});
test("treasury proposal requires fixed beneficiary and owner",()=>{
 const x=treasuryProposal({owner:a,agent:b,beneficiary:c,mint:a,decimals:6,perTx:"1",daily:"2",lifetime:"3",expiresAt:Math.floor(Date.now()/1000)+3600});
 assert.equal(x.status,"review");assert.equal(x.canExecute,false);assert.equal(x.requiresOwnerSignature,true);
});
test("rejects reversed spending limits",()=>{
 const x=treasuryProposal({owner:a,agent:b,beneficiary:c,mint:a,decimals:6,perTx:"3",daily:"2",lifetime:"1",expiresAt:Math.floor(Date.now()/1000)+3600});
 assert.equal(x.status,"denied");
});
test("machine payment draft is not proof of confirmed settlement",()=>{
 const r=machinePaymentReceiptDraft({serviceId:"model-api",requestId:"job1",txSignature:"X".repeat(88),payloadHash:"a".repeat(64),payer:a,recipient:b});
 assert.equal(r.status,"unverified");assert.equal(r.requiresOnchainConfirmation,true);
});
test("provenance commitment does not falsely claim onchain anchoring",()=>{
 const p=provenanceCommitment({kind:"model-output",contentSha256:"a".repeat(64),publisher:"agent-1"});
 assert.equal(p.status,"local-commitment-only");assert.equal(p.onchainAnchored,false);
});
