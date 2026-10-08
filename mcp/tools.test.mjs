import assert from "node:assert/strict";
import test from "node:test";
import { USDC_MINT, coverTerms, usdcPayLink, callTool, DESK } from "./tools.mjs";

test("pay link is a solana pay request for USDC", () => {
  const url = usdcPayLink("E1YYAJtZ9UkWRRotj8FU4NBfkyaSM1yNfqK4fNkdZ73c", 12.5, "Senda job");
  assert.ok(url.startsWith("solana:E1YYAJtZ9UkWRRotj8FU4NBfkyaSM1yNfqK4fNkdZ73c?"));
  assert.ok(url.includes("amount=12.50"));
  assert.ok(url.includes(`spl-token=${USDC_MINT}`));
});

test("cover is four percent and ten percent under the print", () => {
  const t = coverTerms(100, 250);
  assert.equal(t.premiumUsdc, 10);
  assert.equal(t.paysAtOrUnder, 90);
});

test("desk map includes wallets, work, and trade", async () => {
  const map = await callTool("desk_map");
  const paths = map.pages.map((p) => p.path);
  assert.ok(paths.includes("/wallets"));
  assert.ok(paths.includes("/work"));
  assert.ok(paths.includes("/invest"));
  assert.equal(DESK.length, paths.length);
});

test("rules refuse custody", async () => {
  const r = await callTool("rules");
  assert.match(r.account, /does not custody/);
  assert.match(r.agent, /may not sign/);
});
