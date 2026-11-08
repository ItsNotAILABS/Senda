# Liquify Global — fourth core Senda product

Senda's four coordinated product surfaces are **Trade**, **Pay & Send**, **Agents**, and **Liquify**.

**Liquify** is the interface for cross-market token liquidity, quote-size exploration, wallet-native spending and regional payout partner discovery. This is not a token launch, an exchange order book, an issuer, or a bank. The current code presents a governed registry and actionable navigation to existing transaction screens; it **does not connect local bank payouts** simply by listing their markets.

## Regional research rollout

US (USD); Mexico/Spanish LATAM (MXN); Brazil (BRL); South Korea (KRW); Nigeria (NGN); Vietnam (VND); Philippines (PHP); Hong Kong/Chinese-speaking markets (HKD); UAE (AED); Singapore (SGD); Türkiye (TRY). Regions are product research groupings, not regulatory permissions.

The live interface entry is **`/liquify`** after deployment, linked in the global primary navigation. Each market has researched stablecoin/crypto coverage, rail candidates, a local-currency target, source links, explicit operational limits and links to the existing Solana route and payments screens.

The canonical declarative registry is `src/lib/liquify-global.mjs`, not a generated fiat quote sheet. It supplies `LIQUIFY_MARKETS`, `LIQUIFY_RAILS`, and `LIQUIFY_PRODUCTS`. Keep the app, agent docs and market-language translations consistent with that file.

## Integration status contracts

- `code-present` means a code path or integration surface exists somewhere in Senda; **not** that provider credentials, market-maker liquidity, fresh executable quotes, transfers, settlement or local access has been certified.
- `candidate` means provider research and review are required. Do **not** expose a payout or signing CTA for this status.
- `not-connected` means there is no available in-app integration. Show a truthful unavailable state.
- Only quote-driven, signer-controlled routes may create transactions. A listing never grants an agent execution authority.
- Never create or seed fictional USD/USDT balances, card issuing, bank accounts, MXN/BRL/KRW/NGN/VND/PHP/HKD/AED/SGD/TRY payouts, volume, liquidity, route uptime or local-merchant acceptance.

## Liquify development priorities

1. Improve Jupiter V2 taker-bound order/execute flow and route revalidation. Route / quote response is not a fill.
2. Compare Solana AMM quote-size curves (Orca, Raydium, Meteora), Jupiter RFQ coverage and recorded slippage **without double counting** overlapping routes.
3. Harden native USDC and USDT transfers against mint spoofing and incorrect token programs; support SPL/Token-2022 via per-mint validation.
4. Integrate verified payment links, QR acceptance and merchant-side settlement receipts for on-chain currencies. A merchant must independently support the chosen asset.
5. Evaluate international fiat on/off ramps including Bitso for Mexico, and eligible local payment providers by country. Confirm contract, licensing, KYC/AML, fees, limits, fiat counterparties, settlement SLA and chargeback behavior before surfacing actual payouts.
6. Explore Circle CCTP native-USDC flows with supported-chain checks, explicit fees, attestation, destination token accounts, user approval and finality verification.
7. Feed vetted provider discoveries into governed agent work orders: search → source verification → proposal → security/compliance review → tested PR. Never auto-install untrusted packages, auto-merge production code, invent turnover, or sign with user credentials.

## QA / premerge

```bash
node --test scripts/liquify-global.test.mjs
npm run typecheck
npm run build:dev
```

Inspect `/liquify` on desktop/mobile and confirm primary navigation works, research links are safe, no fiat claim is displayed as a live executable route and existing Pay/Trade pages are unchanged.

**Deployment state:** this document describes source code in a GitHub feature branch until merged and deployed; never confuse this with live `senda.pocketnova.app` state.


### Prediction-market research adapter

Real Kalshi market discovery and read-only orderbook depth are available in the integration source under `/social/events`. The public provider is **not a swap/USDC route** and must be excluded from Jupiter DEX liquidity totals or Solscan swap-volume bars. See `docs/LIQUIFY_EVENT_PRODUCTS.md`. User-facing research uses event outcome odds and bounded research budgets. Phantom's own Kalshi experience is not a reusable trading session for Senda and does not grant order placement authority.
