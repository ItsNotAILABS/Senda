import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import { exactRequirement, SOLANA_DEVNET, SOLANA_MAINNET, USDC_MAINNET } from "./x402-exact.ts";

const payee = Keypair.generate().publicKey.toBase58();

test("ten cents is 100000 base units on Solana mainnet exact", () => {
  const row = exactRequirement({ payTo: payee, usd: 0.1, description: "Liquidity brief", url: "/agents/meter" });
  assert.ok(!("error" in row));
  if ("error" in row) return;
  assert.equal(row.x402Version, 2);
  assert.equal(row.accepts[0].scheme, "exact");
  assert.equal(row.accepts[0].network, SOLANA_MAINNET);
  assert.notEqual(row.accepts[0].network, SOLANA_DEVNET);
  assert.equal(row.accepts[0].amount, "100000");
  assert.equal(row.accepts[0].asset, USDC_MAINNET);
  assert.equal(row.accepts.length, 1);
});

test("a ticket over $100 is refused", () => {
  assert.deepEqual(exactRequirement({ payTo: payee, usd: 250, description: "Too big", url: "/agents/meter" }), {
    error: "An exact ticket is $0.01 to $100.",
  });
});
