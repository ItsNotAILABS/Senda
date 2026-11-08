import test from "node:test";import assert from "node:assert/strict";
import {readDflowReceipts,ensureNoDuplicatePrediction,recordDflowSubmitted,observeDflowReceipt} from "../src/lib/dflow-prediction-receipt.mjs";
function store(){const a=new Map();return {getItem:k=>a.get(k)||null,setItem:(k,v)=>a.set(k,v)};}
const sample={wallet:"6".repeat(44),ticker:"KXRAIN-26NOV03-A",side:"yes",amountRaw:"2500000",signature:"7".repeat(88),lastValidBlockHeight:123456};
test("stores real submission and prevents repeat while pending",()=>{
 const s=store();recordDflowSubmitted(s,sample,1800000000000);
 assert.equal(readDflowReceipts(s)[0].status,"pending");
 assert.throws(()=>ensureNoDuplicatePrediction(s,sample));
 observeDflowReceipt(s,sample.signature,"open");
 assert.throws(()=>ensureNoDuplicatePrediction(s,sample));
 observeDflowReceipt(s,sample.signature,"closed");
 assert.doesNotThrow(()=>ensureNoDuplicatePrediction(s,sample));
});
test("does not claim fill from unknown or RPC-only receipt",()=>{
 const s=store();recordDflowSubmitted(s,sample,1800000000000);
 assert.throws(()=>observeDflowReceipt(s,sample.signature,"confirmed"));
 assert.equal(readDflowReceipts(s)[0].status,"pending");
});
test("corrupted ledger fails closed",()=>{
 const s=store();s.setItem("senda.prediction.dflow.v1","{broken");
 assert.throws(()=>readDflowReceipts(s));
});
