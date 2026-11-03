# Senda Market Intelligence — real token data, pool candles and execution boundaries

Feature branch: `feature/market-intelligence-terminal-20261026`. Proposed routes after merge and deployment:
- `/wire` → **Intelligence** tab.
- `/invest` → **Matrix** workspace.

## Connected market sources

1. Senda's official Jupiter Tokens V2 categories deliver the spot-market token catalogue, USD price, reported token liquidity, organic score, explicit percentage-point price changes, source `updatedAt`, and the sum of *reported* 24-hour token buy/sell USD volume. We retain null for absent stats rather than substituting zero. Query host is `api.jup.ag`; `lite-api.jup.ag` is scheduled to close October 30, 2026.
2. The token catalogue is cached for 60 seconds per server process with an in-flight request gate. Without a `SENDA_JUPITER_API_KEY` **server-only** secret, it paces category requests approximately 2.1 seconds apart to respect the official 0.5 RPS keyless limit. A paid server key may improve access. Zero-price legacy watch candidates remain explicitly unpriced.
3. The selected market fetches GeckoTerminal Solana pool candles in USD, targeting the exact selected token mint, not the other side of the pool. A fallback historical DefiLlama price series is labeled **price only, no trade volume**.
4. The PreStock catalogue can contain historical fixed fallback examples. The scanner **does not reuse those values as live quotes**. Only matching independently returned Jupiter tokens can show a live market token price; otherwise the row is available for research with blank price/changes. A fresh Jupiter executable quote is still necessary to trade any asset.

## Analysis

- Only valid, chronological OHLCV bars are evaluated, with at least 30 observations for full signal checks and 21 positive-volume pool bars for relative volume.
- EMA 9/21 trend; Wilder RSI 14; ATR 14 / price; 20-bar rolling OHLCV VWAP approximation; 20-bar OBV proxy; prior-20-bar breakout; last USD volume; volume relative to the previous 20 candles.
- The *research-only* alignment score is computed from transparent trend, volume, breakout and ATR conditions, ranging 0–100. Missing, stale, synthetic, price-only, or zero-volume sources never get a volume-driven score.
- Manual comparative scans inspect at most **six** chosen/watchlisted assets on demand. No unaudited, autonomous orders or infinite batch crawler.
- A Senda market selection is transferred to Trade via a one-time local browser session key. It does not pass a wallet signature, trade amount, or transaction approval.
- Jupiter-reported token-wide liquidity/24h volume and GeckoTerminal single-pool candle volume are **not** combined as though they describe the same venue or order book.

## Honest limitations

- The selected top pool is not a consolidated depth-of-book; pool OHLCV volume does not measure aggressor-level buy/sell order-flow, genuine order-book imbalance, or slippage at execution size.
- Screens remain research-only. Trade execution, chain authority, holdings, fees, and settlement use separate user-signed routes. This work does not enable agents to sign unattended.
- The end-user Senda app still needs a full TypeScript + Vite build and wallet E2E; unit tests validate deterministic metrics, not the whole frontend.
- The host's scheduled market-data snapshots are not a historical tick warehouse. True professional multi-venue scanning needs a durable time-series store, websocket/feed licensing, source health monitoring and real-time executable quote checks.

## Validation

```sh
node --test scripts/market-quality.test.mjs scripts/jupiter-token-metrics.test.mjs
npm ci
npm run typecheck
npm run build:dev
```

No live trades or deployment were performed as part of this branch.
