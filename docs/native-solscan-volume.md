# SENDA Native Volume — Solscan Pro + Go Liquify

The Market Matrix now has **two separate measured volume instruments**:

1. **GeckoTerminal pool OHLCV** — price candles and USD volume for a single selected Solana pool. These are historical pool transactions, not all token-wide swaps.
2. **Solscan Pro DeFi activity index** — time-bucketed on-chain swaps involving a selected mint. Only swaps with an **explicit USDC side and verified six-decimal raw USDC amount** contribute to buy/sell notional bars. This is USDC notional, **approximately USD**, not a guaranteed dollar price. SOL, USDT, unknown-route, malformed or ambiguously priced transactions are counted as *unpriced* rather than multiplied by spot prices.

**Never add the two volume series together**: they have overlapping underlying transactions and different coverage. Never describe either as an order book, executable liquidity, resting bid/ask depth, or market-maker inventory. No trading volumes, empty-market activity, swap fills, settlement or profit figures are fabricated.

## Connection

The Solscan Pro token DeFi endpoint is `GET https://pro-api.solscan.io/v2.0/token/defi/activities`. Required `address` is the Solana mint, alongside `from_time`, `to_time`, `page`, `page_size`, `sort_by=block_time`, `sort_order=desc`, and the two swap `activity_type[]` values. The official Pro token goes in an HTTP `token` header — **never** a browser query string.

Set **one** of these server-side configurations:

- **Recommended native Go engine:** `SENDA_SOLSCAN_PRO_API_KEY` in the private Liquify Go service plus `SENDA_LIQUIFY_ORIGIN` and `SENDA_ROUTER_INTERNAL_KEY` in the Senda app server. Go serves `GET /v1/volume?mint=<mint>&tf=1H`. Do not expose the Go process publicly without private ingress, authentication, rate limiting and TLS.
- **Simpler server-only fallback:** `SENDA_SOLSCAN_PRO_API_KEY` on the Senda web server. The TanStack server function fetches the index internally, not from the visitor's browser.

Go prefers native index ingestion; if unavailable the app server may use the separately configured Solscan key. If neither is configured, users see an explicit **not connected** state, not fake zeros.

## Safeguards

- Strict mint allowlist format, 15m / 1H / 4H / 1D bars, up to 24h observation, five pages of at most 100 indexed swaps per request.
- Deduplicates by transaction signature, preferring top-level aggregated swaps over child-like direct activities. This is conservative; multiple independent swaps in the same transaction can be **undercounted** unless instruction-level identifiers are later added. The current feed is a lower-bound estimate, not proof of exhaustive token-wide turnover.
- Rejects unsafe or non-six-decimal USDC amounts. Uses integer-safe raw token units; refuses amounts beyond 2^53 - 1. Never guesses unsupported token prices.
- Even if the API is paginated to exhaustion, the latest **still-open** interval remains unknown when unobserved. Earlier fully covered empty intervals show zero; truncated pagination shows unknown missing bars.
- Solscan can lag and may omit other venues or trade classes. Display data freshness, completeness, priced and unpriced counts. API rate limits or provider failures fail closed.
- 45-second short cache, single-flight per mint/timeframe, bounded Go index retrieval, private server-to-server key. Browser receives only public activity summaries.
- Solscan `routers.token1/token2` ordering is used as a **buy/sell direction inference**, not an aggressor/maker-side label. The UI explicitly says "USDC→token" and "token→USDC."

## Validation

```bash
# Senda root
node --test scripts/solscan-volume.test.mjs scripts/liquify-math.test.mjs
npm run typecheck
npm run build:dev

# Native engine
cd services/liquify
go test ./...
go vet ./...
go run .
```

Go health `/healthz` measures service availability, **not** active Solscan credentials or market coverage. Verify positive Solscan observations against known transaction signatures before enabling production marketing claims. A full historical backfill would require durable index storage, checkpoints, cursor-based recovery, higher API limits and multi-transaction indexing; this update intentionally performs read-only, capped, recent-window ingestion.

## Liquidity interpretation

Real trading liquidity is **not equivalent** to volume bars. The separate `/v1/ladder` samples actual Jupiter V2 quote-size availability for bounded USDC amounts. Jupiter's router can compare available underlying integrations, but Senda has no direct market-maker inventory commitment or invented quotes. A successful quote-only response never authorizes wallet signing.
