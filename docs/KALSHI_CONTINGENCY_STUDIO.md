# Senda Event Markets & Contingency Lab — November 13, 2026

## Product surfaces

- **`/social/events`** — redesigned Senda prediction terminal, sourced Kalshi public market discovery, topic filters, order-book-informed research, contract terms and authorized venue routing.
- **`/social/contingency`** — direct link to the same canonical studio's Contingency Lab. Five scenario families: weather, shipping, energy, macro and technology timing. Not insurance.
- **Venue routes** — Phantom U.S. Kalshi mobile handoff; public Kalshi research; approval-gated DFlow Solana-native outcome token transactions signed by Phantom; independent Phantom World and Polymarket public discovery.
- **Local watchlist** — ticker-only browser storage. No positions, balances, funds or orders are imported or fabricated.

## Native price and volume history

The terminal includes a new source-backed chart on each Kalshi market with 24-hour, 7-day, and 30-day ranges using the official [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) endpoint. Series tickers originate in the public Kalshi events catalog. The server only fetches the requested exact series/market pair on fixed Kalshi infrastructure. Contract close prices and native period volume are normalized independently; source-null or missing prices/volumes are never replaced with fake candles. The SVG chart leaves gaps across missing observations rather than interpolating them. Actual zero is displayed only when the venue explicitly reports zero.

## Data architecture and provenance

`src/lib/kalshi-book.ts` uses the documented Kalshi public Events API (`GET /trade-api/v2/events?status=open&with_nested_markets=true`) and a bounded index walk. `event-market-discovery.mjs` classifies public titles into Senda-owned discovery categories; these are NOT official Kalshi series taxonomy and do not prove related contracts are equivalent.

The detail inspector uses the official **Get Market** endpoint to display exact `rules_primary`, `rules_secondary`, status, expiry, reported 24-hour volume and open interest. Fixed known host, regex-constrained ticker, 7-second timeout and a bounded cache. The existing public order-book reader supplies opposing bids, and the conservative estimator `planEventSide()` matches these only while at most 30 seconds old.

**Financial truth**: a public bid/ask or gross depth estimate is not a taker-bound executable order. Fee estimates, actual liquidity at submission, market eligibility and Kalshi session are not available from public market data. Unreported activity is labeled unknown and not zero; stale data is held rather than showing fabricated bids.

## Phantom execution distinction

1. **Kalshi account inside Phantom U.S.**: users complete Kalshi's own account, KYC and venue eligibility within Phantom's native mobile experience. A Phantom `signMessage()` acknowledgement of Senda research cannot submit orders to this account.
2. **DFlow on Solana**: a separate on-chain outcome-token execution route MAY be signed with Phantom, but only after Senda receives approved DFlow partner access, Proof identity checks, independent age/jurisdiction eligibility, exact outcome mint verification, program allowlisting, short quote freshness and transaction simulation. The branch's existing DFlow lane is OFF by default; no real orders/funds were moved.
3. **Polymarket and World**: independent venues with distinct funding and settlement; Senda does not reuse Kalshi quotes or claim shared positions across venues.

## Contingency scenarios are NOT insurance

The Contingency Lab uses a real public-book **research estimate** of chosen YES or NO contracts to compute four independent states: selected outcome wins/loses versus a separate real-world expense occurs/does not occur. The result is an accounting illustration only, before fees, taxes, basis differences, settlement risk and market impact.

It adds a **self-funded cash reserve planner** that never assumes event-contract winnings. Event resolution and customer financial loss are not causally or legally equivalent. No licensed insurance policy, claims servicing, loss adjustment, premium for insurance coverage, underwriting, indemnification, guaranteed hedge or reimbursement exists in this branch.

A legitimate future regulated parametric insurance product requires licensed insurer/MGA/carrier or approved partner, jurisdiction-specific counsel, product/underwriting rules, actuarial reserves, claims and consumer disclosures, and explicit policy regulatory authorization. **Do not activate a real insurance sale by relabeling event contracts.**

## Release verification

```bash
node --test scripts/contingency-analysis.test.mjs
node --test scripts/kalshi-history.test.mjs
npm ci
npm run typecheck
npm run build:dev
```

Additional browser QA: disconnected wallets and Phantom mobile, Kalshi API errors and rate limits, stale/missing bids, empty search, 30-second depth expiry, contract rule retrieval, watchlist on private browsing, screen-reader access and all viewport widths. Reconcile data freshness with Kalshi official APIs and ensure price/volume number units match the published schema.

**Status: code source pushed, NOT production deployed** until these gates and real Kalshi/DFlow provider contracts are validated.

## Documentation references

- Kalshi [Get Market](https://docs.kalshi.com/api-reference/market/get-market) — public contract status, prices, volume and rules.
- Kalshi [Get Events](https://docs.kalshi.com/api-reference/events/get-events) — market discovery and cursor pagination.
- [Phantom](https://phantom.com/) and [DFlow](https://docs.dflow.net/) — distinct wallet versus partner execution pathways.
