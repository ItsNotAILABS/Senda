import test from "node:test";import assert from "node:assert/strict";
import {makePredictionAcknowledgement,validatePredictionAcknowledgement} from "../src/lib/phantom-prediction-intent.mjs";
const now=1800000000000,defaults={wallet:"6".repeat(44),ticker:"KXRAIN-26NOV03-A",side:"yes",contracts:5,grossUsd:2.2,quotedAt:now-2000,createdAt:now,origin:"https://senda.pocketnova.app",nonce:"a".repeat(32)};
test("includes explicit read-only intent and short expiry",()=>{
 const {message,record}=makePredictionAcknowledgement(defaults);
 assert.match(message,/NOT an order/);assert.equal(record.tradingAuthority,"NONE");
 assert.equal(record.execution,"NOT_SUBMITTED");assert.equal(record.fundsMoved,false);
 assert.equal(validatePredictionAcknowledgement(record,now+500),true);
 assert.equal(validatePredictionAcknowledgement(record,now+120001),false);
});
test("rejects replayed/expired quote and invalid origin",()=>{
 assert.throws(()=>makePredictionAcknowledgement({...defaults,quotedAt:now-31000}));
 assert.throws(()=>makePredictionAcknowledgement({...defaults,origin:"https://evil.example"}));
 assert.throws(()=>makePredictionAcknowledgement({...defaults,nonce:"predict"}));
});
test("no misleading signature authority or modified record",()=>{
 const {record}=makePredictionAcknowledgement(defaults);
 assert.equal(validatePredictionAcknowledgement({...record,tradingAuthority:"EXECUTE"},now),false);
 assert.equal(validatePredictionAcknowledgement({...record,fundsMoved:true},now),false);
 assert.equal(validatePredictionAcknowledgement({...record,execution:"FILLED"},now),false);
});
test("invalid amounts and markets fail closed",()=>{
 assert.throws(()=>makePredictionAcknowledgement({...defaults,contracts:0}));
 assert.throws(()=>makePredictionAcknowledgement({...defaults,contracts:1.5}));
 assert.throws(()=>makePredictionAcknowledgement({...defaults,ticker:"../admin"}));
 assert.throws(()=>makePredictionAcknowledgement({...defaults,grossUsd:NaN}));
});
