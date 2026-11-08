# SENDA Liquify Event Products — real Kalshi data, no delegated trade authority

## Product scope

Senda has a real read-only Kalshi market catalog in `src/lib/kalshi-book.ts`, and this work extends it with per-market public orderbook depth. The new research desk is `/social/events` (within Senda's Prediction product), cross-linked from `/liquify`. It is a venue-backed event-market **research interface**, not a simulated marketplace and not an executable broker.

### Data and orderbook mechanics

- Public Kalshi API: `GET https://external-api.kalshi.com/trade-api/v2/markets/{ticker}/orderbook?depth=20`. Official documentation: https://docs.kalshi.com/api-reference/market/get-market-orderbook
- The API returns `orderbook_fp.yes_dollars` and `orderbook_fp.no_dollars` as fixed-point dollar bids and contract sizes. It does **not** return resting asks. To estimate buying YES, the planner consumes opposing NO bids at prices `1 - NO bid`; to estimate buying NO, it consumes opposing YES bids.
- It sums actual source-depth levels up to the requested whole-contract quantity. It does not use last prices, synthetic slippage, token chart candles, SOL/USDC FX prices, or invented order book levels as fill evidence.
- Responses carry fetch timestamps, become stale at 30 seconds, and are cached server-side for at most eight seconds. Provider failures, no book, zero volume and insufficient depth return explicit unavailable/research-only states.
- Gross price estimates exclude fees; fees are labeled unknown. Maximum gross payout is the number of binary contracts for full winners, subject to actual Kalshi rules. Settlement terms, early close, fractional contracts, market pause, cancellations and fees may alter actual execution and payout.
- Query validity is checked server side. No arbitrary API URL, secret, user session or external CORS proxy is accepted from the client.

### Phantom / Kalshi relationship

Phantom's integrated Kalshi experience offers an onboarded trading path for eligible customers, but **Senda cannot inherit Phantom's Kalshi session or sign orders through it**. Wallet authorization and venue brokerage/API identity are distinct. The existing Senda `kalshi-link.ts` has optional Kalshi API private-key validation; it should not be interpreted as approval for in-app order entry, and sensitive PEMs must never be logged or copied into agent prompts.

No event-market trades, deposits, withdrawals, escrow, settlement or position imports happen inside the new Senda event workspace. An official Kalshi link is offered so a user can use their own eligible venue account. Any future native execution connector needs a documented integration agreement/API permission, account security, authorized authentication, explicit order review, fee disclosure, jurisdiction checks and reconciliation receipts. Never pretend a Phantom wallet connection alone creates access.

### Event-based products worth building

- **Rain-out travel planning:** A user can compare the terms of an actual weather prediction contract with potential trip disruption and see quote-size estimates. A Kalshi event payout is *not insurance*. Coverage for a real traveler, hotel or guest requires separate insurance underwriting, claims handling, licensing and an exact correlation to loss.
- **Supply-chain contingencies:** Map port closure, weather and logistics markets to known project cost windows; the event market is a research proxy, not compensation for real delayed freight.
- **Energy budgeting:** Use genuine energy event contracts in a budget risk view; recognize that contract settlement is distinct from a utility bill.
- **Macro treasury planning:** Compare event contracts about inflation, interest rates and macro policy with scenario budgets, without promising a direct FX hedge.
- **Tech procurement planning:** Track verified AI/release/regulatory events with contract rules and a research-only budget.

Contracts must be matched by event title/category, and product plans require exact rules to be reviewed by the user. A sports wager is not a rain-out budget product.

## Liquify integration design

A prediction venue is a **separate destination from Solana AMM routing**. It must not be included as executable Jupiter swap inventory, USDC token liquidity, Solscan transaction volume or direct RFQ depth. A future venue adapter should implement `discoverMarkets`, `fetchDepth`, `capabilityProof`, `prepareOrder`, `userAuthorize`, `submit`, `confirm`, and `reconcile`, with each non-read method unimplemented until commercially and technically approved.

The reusable pure engine `src/lib/event-contract-router.mjs` currently implements only public bid-depth inspection, gross scenario costs, explicit budget gates, quote freshness and theme matching. It cannot place trades.

## Release gates

```sh
node --test scripts/event-contract-router.test.mjs
npm ci
npm run typecheck
npm run build:dev
```

Then perform a real external-source verification: check one known Kalshi ticker's price levels against its published orderbook, verify YES and NO complement mathematics, manually test stale/empty/closed markets, and inspect the desktop/mobile interface. No live trading or automatic protection products should be claimed until the applicable venue and regulated-partner requirements are satisfied.


## Signed Phantom research acknowledgement (new)

The research UI optionally requests a real injected Phantom wallet signature over a fresh market **research preview**. It verifies Ed25519 locally using tweetnacl and the wallet public key with no secret transmission. The structured record explicitly states tradingAuthority: NONE, execution: NOT_SUBMITTED and fundsMoved: false; the signature neither pays a prediction stake nor submits a Kalshi order. Research acknowledgements expire, are not stored server-side and are not authorized trading intents. A production web origin is required.

The supported mobile flow opens **Senda inside Phantom** for signMessage, not Phantom's native Predict tab. A user must separately open Phantom > Predict to make real bets. Phantom's U.S. Kalshi integration is a regulated account experience subject to eligibility and verification; outside the U.S., World Prediction Markets is a separate protocol and must not be interchanged with Kalshi. Do not send outcome tokens through Senda's normal Jupiter trading route without explicit product support. References: https://help.phantom.com/articles/56546828429587 and https://phantom.com/us-prediction-markets-disclosures.
