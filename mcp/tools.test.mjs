import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { USDC_MINT, coverTerms, usdcPayLink, callTool, DESK, BASKETS, handleAgentHttp } from "./tools.mjs";

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

test("desk map includes wallets, work, trade, and clearing", async () => {
  const map = await callTool("desk_map");
  const paths = map.pages.map((p) => p.path);
  assert.ok(paths.includes("/wallets"));
  assert.ok(paths.includes("/work"));
  assert.ok(paths.includes("/invest"));
  assert.ok(paths.includes("/equities"));
  assert.ok(paths.includes("/clearing"));
  assert.equal(DESK.length, paths.length);
});

test("rules refuse custody", async () => {
  const r = await callTool("rules");
  assert.match(r.account, /does not custody/);
  assert.match(r.agent, /may not sign/);
  assert.match(r.gift, /link hash/);
});

test("markets keep Monad as a price and WMON as a Jupiter market", async () => {
  const book = await callTool("markets");
  assert.ok(book.solana.some((row) => row.symbol === "WMON" && row.sign === "jupiter"));
  assert.ok(book.priceOnly.some((row) => row.symbol === "MON" && row.sign === "price"));
  assert.equal(book.evm.find((row) => row.tape === "ETH").symbol, "WETH");
});

test("baskets match the desk themes", () => {
  const source = readFileSync(new URL("../src/lib/basket.ts", import.meta.url), "utf8");
  for (const pack of BASKETS) {
    assert.match(source, new RegExp(`id: "${pack.id}"`));
    for (const symbol of pack.symbols) assert.match(source, new RegExp(`"${symbol}"`));
  }
});

test("clearing does not invent a chain head", async () => {
  const row = await callTool("clearing");
  assert.equal(row.parallax.deployed, false);
  assert.equal(row.mastercard.secrets.length, 4);
});

test("gift window refuses a secret and closes an old link", async () => {
  await assert.rejects(() => callTool("gift_window", { secret: "not-for-the-server" }), /link hash/);
  const open = await callTool("gift_window", { expiresAt: 2_000, now: 1_000 });
  const shut = await callTool("gift_window", { expiresAt: 2_000, now: 3_000 });
  assert.equal(open.open, true);
  assert.equal(shut.open, false);
  assert.deepEqual(open.windows.map((row) => row.id), ["1h", "1d", "7d"]);
});

test("a quote above the cap never asks Jupiter", async () => {
  await assert.rejects(() => callTool("quote_swap", { mint: "x".repeat(32), usd: 5001 }), /5000/);
  await assert.rejects(() => callTool("quote_evm", { tape: "MON", usd: 10 }), /cannot sign/);
});

test("the HTTP API lists the same tools and does not echo a secret", async () => {
  const listed = await handleAgentHttp("GET");
  const body = JSON.parse(listed.body);
  assert.equal(body.sign, false);
  assert.ok(body.tools.some((tool) => tool.name === "quote_swap"));
  assert.ok(body.tools.some((tool) => tool.name === "quote_evm"));
  const refused = await handleAgentHttp("POST", JSON.stringify({ name: "gift_window", arguments: { secret: "keep-me" } }));
  assert.equal(refused.status, 400);
  assert.equal(refused.body.includes("keep-me"), false);
});
