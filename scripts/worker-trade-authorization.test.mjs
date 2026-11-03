import test from "node:test";
import assert from "node:assert/strict";
import {authorizeWorkerTrade} from "../src/lib/worker-trade-authorization.mjs";
const good=()=>({status:"active",autonomy:"queue",tools:["trade","matrix"],side:"buy",symbols:["OPENAI"],maxUsd:30,queue:{symbol:"OPENAI",side:"buy",usd:25}});
test("allows exact bounded queued action",()=>assert.equal(authorizeWorkerTrade(good(),30,"OPENAI").usd,25));
test("paused workers and missing queue cannot sign",()=>{assert.throws(()=>authorizeWorkerTrade({...good(),status:"paused"},30,"OPENAI"),/No transaction was signed/);assert.throws(()=>authorizeWorkerTrade({...good(),queue:null},30,"OPENAI"),/No transaction was signed/);});
test("enforces worker authority, intent side and exact asset",()=>{for(const edit of [{autonomy:"draft"},{tools:["matrix"]},{side:"sell"},{symbols:["OTHER"]}])assert.throws(()=>authorizeWorkerTrade({...good(),...edit},30,"OPENAI"),/No transaction was signed/);assert.throws(()=>authorizeWorkerTrade(good(),30,"OTHER"),/No transaction was signed/);});
test("refuses over-budget or nonfinite quantities",()=>{assert.throws(()=>authorizeWorkerTrade(good(),20,"OPENAI"),/No transaction was signed/);assert.throws(()=>authorizeWorkerTrade({...good(),queue:{...good().queue,usd:100}},30,"OPENAI"),/No transaction was signed/);assert.throws(()=>authorizeWorkerTrade({...good(),queue:{...good().queue,usd:NaN}},30,"OPENAI"),/No transaction was signed/);});
