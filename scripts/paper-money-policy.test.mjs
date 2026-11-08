import test from "node:test";import assert from "node:assert/strict";
import {paperLedgerEnabled,UNSETTLED_PAYMENT_MESSAGE} from "../src/lib/paper-money-policy.mjs";
test("paper fiat/cash credits fail closed in production and test mode",()=>{
 assert.equal(paperLedgerEnabled("production","true"),false);
 assert.equal(paperLedgerEnabled("test","true"),false);
 assert.equal(paperLedgerEnabled("development",""),false);
 assert.equal(paperLedgerEnabled("development","true"),true);
 assert.match(UNSETTLED_PAYMENT_MESSAGE,/not a real settled payment/);
});
