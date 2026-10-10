import assert from "node:assert/strict";
import test from "node:test";
import { SOLANA_MORE, mapChains, mapSolana } from "../src/lib/chain-tape-map.mjs";

const BONK = SOLANA_MORE.find((row) => row[0] === "BONK")[2];

test("a jupiter percent is stored as a fraction and a missing price is dropped", () => {
  const rows = mapSolana({
    [BONK]: { usdPrice: 0.00002, priceChange24h: 5 },
    dead: { usdPrice: 0, priceChange24h: 1 },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].symbol, "BONK");
  assert.equal(rows[0].lane, "solana");
  assert.equal(rows[0].change24h, 0.05);
  assert.match(rows[0].href, /jup\.ag\/swap\//);
});

test("a defillama percent is stored as a fraction and a coin without a price is left off", () => {
  const rows = mapChains(
    { coins: { "coingecko:bitcoin": { price: 100 } } },
    { coins: { "coingecko:bitcoin": -2.5, "coingecko:ethereum": 4 } },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].symbol, "BTC");
  assert.equal(rows[0].lane, "chain");
  assert.equal(rows[0].change24h, -0.025);
  assert.equal(rows[0].href, null);
  assert.equal(rows[0].venue, "Bitcoin");
});
