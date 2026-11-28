import assert from "node:assert/strict";
import test from "node:test";
import { readPayCode } from "./qr-pay.ts";

const ADDR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

test("a bare address, a solana bill, and a link all name the same recipient", () => {
  assert.equal(readPayCode(ADDR).ok && readPayCode(ADDR).to, ADDR);
  const bill = readPayCode(`solana:${ADDR}?amount=12.5&label=Cafe&spl-token=${ADDR}`);
  assert.equal(bill.ok && bill.kind, "solana-pay");
  assert.equal(bill.ok && bill.amount, 12.5);
  assert.equal(bill.ok && bill.label, "Cafe");
  const link = readPayCode(`https://phantom.app/ul/v1/browse?address=${ADDR}`);
  assert.equal(link.ok && link.to, ADDR);
});

test("an ethereum code is refused instead of treated as Solana", () => {
  const row = readPayCode("0x52908400098527886E0F7030069857D2E4169EE7");
  assert.equal(row.ok, false);
});
