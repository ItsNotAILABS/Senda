import assert from "node:assert/strict";
import test from "node:test";
import { SOLANA_MORE } from "../src/lib/chain-tape-map.mjs";
import { balanceOfCall, decodeBalance, evmMarketFor, pairAllowed, quoteIsSane, rawAmount, readLifi, sellRaw, solTxLink, solanaDecimals, txLink } from "../src/lib/trade-book.mjs";

const BONK = SOLANA_MORE.find((row) => row[0] === "BONK")[2];

test("a listed solana mint can be swapped for usdc and a random mint cannot", () => {
  const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  assert.equal(pairAllowed(usdc, BONK), true);
  assert.equal(pairAllowed(usdc, "not-a-mint"), false);
  assert.equal(solanaDecimals(BONK), 5);
});

test("twenty five dollars of usdc is 25000000 raw units", () => {
  assert.equal(rawAmount(25, 6), 25000000n);
});

test("bitcoin on this desk is wrapped bitcoin on ethereum", () => {
  const market = evmMarketFor("BTC");
  assert.equal(market.symbol, "WBTC");
  assert.equal(market.chainId, 1);
  assert.equal(evmMarketFor("ADA"), null);
});

test("a quote more than five percent under the dollars in is refused", () => {
  assert.equal(quoteIsSane("25", "24.2"), true);
  assert.equal(quoteIsSane("25", "20"), false);
});

test("a sell uses the wallet balance when the dollar size is larger than the holding", () => {
  const held = rawAmount(2, 6);
  assert.equal(sellRaw(25, 1, 6, held.toString()), held);
  assert.equal(sellRaw(1, 1, 6, rawAmount(2, 6).toString()), 1000000n);
  assert.equal(sellRaw(25, 1, 6, "0"), 0n);
});

test("a balance call and a transaction link use the chain that holds the token", () => {
  const call = balanceOfCall("0x1111111111111111111111111111111111111111");
  assert.match(call, /^0x70a08231/);
  assert.equal(decodeBalance("0x0f"), 15n);
  assert.equal(txLink(1, "0xabc"), "https://etherscan.io/tx/0xabc");
  assert.equal(solTxLink("sig"), "https://solscan.io/tx/sig");
  assert.equal(balanceOfCall("nope"), "");
});

test("a lifi body becomes a signable quote only when the transaction is present", () => {
  const bare = readLifi({ estimate: { toAmount: "10", tool: "uniswap", fromAmountUSD: "25", toAmountUSD: "24.8" } });
  assert.equal(bare.ready, false);
  assert.equal(bare.tool, "uniswap");
  const ready = readLifi({
    estimate: { toAmount: "10", toAmountMin: "9", tool: "nordstern", approvalAddress: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" },
    transactionRequest: { to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE", data: "0xabc", chainId: 1, gasLimit: "200000", value: "0x0" },
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.chainId, 1);
  assert.equal(readLifi({}), null);
});
