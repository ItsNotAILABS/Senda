<p align="center">
  <img src="public/banner.jpg" width="100%" alt="Senda — wallet-native financial workspace">
</p>

<div align="center">

# SENDA
### Your wallet. A world of possibilities.

**Bring Your Own Wallet (BYOW).** Connect what you already own. Discover, trade, move, and use digital assets from one desk — with your wallet in control.

[**Open Senda**](https://senda.pocketnova.app) · [**Explore the desk**](#the-desk) · [**Wallet support**](#your-wallet-comes-first) · [**Developers**](#for-builders)

<br>

![Wallet-native](https://img.shields.io/badge/BYOW-wallet--native-171d26?style=flat-square&labelColor=d8ff4f)
![Markets](https://img.shields.io/badge/markets-Solana%20%2B%20EVM-171d26?style=flat-square&labelColor=34d9ff)
![Execution](https://img.shields.io/badge/execution-user--signed-171d26?style=flat-square&labelColor=9a6cff)

</div>

---

## One wallet. More possibilities.

Senda is not just a PreStocks app. It connects **crypto trading, tokenized markets, USDC payments, liquidity research, portfolio tools, and governed AI** in a single wallet-first workspace.

| **BUY & TRADE** | **CONVERT** | **SEND** |
| :--- | :--- | :--- |
| Discover Solana markets, xStocks, PreStocks and supported derivatives venues. | Inspect Jupiter and supported LI.FI routes before signing. | Send USDC and create wallet-signed payment requests. |
| [Explore Trade](https://senda.pocketnova.app/invest) | [Open Convert](https://senda.pocketnova.app/wallet) | [Open Payments](https://senda.pocketnova.app/payments) |
| **RESEARCH** | **PLAY & CREATE** | **AI AGENTS** |
| Liquify quote-size curves, pool candles, Solscan activity and market-quality checks. | Explore market-based experiences, work listings and creative tools. | Give bounded agents research tasks; approve any resulting wallet action yourself. |
| [Market Intelligence](https://senda.pocketnova.app/market-intelligence) | [Explore Senda](https://senda.pocketnova.app/social) | [Agent Studio](https://senda.pocketnova.app/agents) |

<p align="center">
  <a href="public/video/desk.mp4"><img src="public/cover.jpg" width="49%" alt="Senda desk — watch product preview"></a>
  <a href="public/video/card.mp4"><img src="public/images/metal-card.jpg" width="49%" alt="Senda payment experience — watch preview"></a>
</p>

<sub>Images and videos above are existing Senda repository assets. A card visual is not proof of a scheme-issued payment card. Venue access depends on the wallet, chain, liquidity and provider.</sub>

## Your wallet comes first

**Bring your own wallet. Keep your signing authority.** Senda connects to compatible installed wallets; it does not need your recovery phrase or take ownership of the signing key for ordinary wallet-signed swaps and transfers.

| Solana wallet adapters | EVM wallet adapters |
| --- | --- |
| **Phantom · Solflare · Backpack · Glow** | **MetaMask · Rabby** |
| OKX · Bitget · Trust · Coinbase (Solana) | Coinbase Wallet · Brave Wallet |

Adapters are implemented in [wallet detection](src/lib/wallets.ts). Availability depends on browser, wallet provider and device; **not every wallet signs every route**.

**Connect → Inspect quote → Approve in your wallet → Verify on-chain.**

Your balances come from the connected wallet and chain reads. A market price is not an executable quote, and a submitted signature is not a confirmed fill. Some experimental pocket and game-pot features use **device-generated keys**, a different security model that requires additional review before funded use.

<p align="center">
  <img src="public/images/hero.jpg" width="49%" alt="Senda visual identity">
  <img src="public/images/markets-desk.jpg" width="49%" alt="Senda market desk">
</p>

## The desk

### Markets without the silos

Explore Solana spot markets, stablecoins, tokenized listed equities, PreStocks, liquid staking and supported EVM instruments. Senda also contains venue-specific code for **Jupiter Perps, Hyperliquid and Ostium**. Availability and permissions are determined by each external venue, and tokenized exposure is not necessarily direct ownership of underlying shares.

| Market lane | What Senda connects |
| --- | --- |
| **Crypto & stablecoins** | SOL, USDC, selected USDT/PYUSD routes, and quote-eligible Solana tokens |
| **Tokenized assets** | PreStocks, Tessera, xStocks, and xStocks/Kamino market research |
| **EVM markets** | Listed routes for WETH, WBTC, LINK, UNI, ARB, OP, WBNB and WAVAX; supported chains vary by venue |
| **Trading & derivatives** | Wallet-signed venue integrations, price research, and separate experimental derivatives tools |

[Market catalog](docs/OFFERINGS.md) · [Solana/EVM routes](src/lib/trade-book.mjs) · [Instrument book](src/lib/sol-house.ts)

### Liquify: measure the route, not the hype

Senda's **Liquify** tools sample real *indicative* Jupiter quote sizes, analyze observed pools and index Solscan activity through a read-only Go service. They do **not** claim to operate an exchange, supply resting orders, or guarantee settlement.

[Liquify Go service](services/liquify/README.md) · [Volume methodology](docs/native-solscan-volume.md) · [Market Intelligence](https://senda.pocketnova.app/market-intelligence)

### Move value

Wallet-signed Solana USDC transfers, requests and Solana Pay links sit alongside chain-dependent bridging and payments research. Senda does **not** itself guarantee fiat withdrawal, bank settlement, merchant card acceptance or a Mexico cash-out.

[Payment code](src/lib/solana-pay.ts) · [LI.FI routes](src/lib/lifi.ts)

### Intelligence you govern

Senda's agent workspace can watch markets, produce research, create notes and queue bounded actions. **The wallet still signs.** Utility AI uses evidence-led reports, while Genesis offers collectible-aware research workflows when ownership verification is configured.

[Agent workspace](src/lib/agent-workspace.ts) · [Utility AI](docs/production-utility-ai.md) · [Genesis runtime](src/lib/genesis-runtime.mjs) · [Read-only MCP](mcp/README.md)

<p align="center">
  <img src="public/images/orbit.jpg" width="49%" alt="Senda discovery visual">
  <img src="public/images/term-sheet.jpg" width="49%" alt="Senda research visual">
</p>

## Built with an open financial ecosystem

Rather than an enormous wall of logos, Senda documents integrations **by what they actually do**.

| Execution & routing | Data & market discovery | Intelligence & infrastructure |
| --- | --- | --- |
| **Jupiter** swaps and perps | **GeckoTerminal** pool OHLCV | **Go Liquify** quote research |
| **LI.FI** EVM/bridge routes | **Solscan Pro** indexed activity | **Senda MCP** read/quote tools |
| **Hyperliquid · Ostium** venue adapters | **PreStocks · Tessera · xStocks** | **Utility AI · Genesis · PARRALAX** |
| **Solana Pay** transfers | **Kamino** market metrics; selected public prediction-market feeds | Optional model/API and ownership verification |

<sub>Integration code is not equal to an active partnership or universal live access. Solscan Pro, certain AI services, Genesis verification and commercial card APIs require their own provider configuration. PARRALAX's on-chain risk interface is a design contract, not a funded settlement program.</sub>

## What is available — and what is still being built

| Area | Implementation boundary |
| --- | --- |
| **Wallet-first core** | Wallet detection, transaction construction, swap and transfer signing paths, confirmation/recovery logic. Needs actual provider and end-to-end release verification. |
| **Markets & Liquify** | Live-source adapters, venue-specific routes, research models and quote-only Go infrastructure. No Senda-owned liquidity guarantee. |
| **AI & Genesis** | Browser-local bounded agents and research, optional server-side model, optional on-chain asset verification. No autonomous wallet signing. |
| **Payments & cards** | Wallet-signed USDC payments exist in code. Browser-local checkout numbers are not network-accepted cards; Mastercard Commercial Connect is a separate configuration-gated integration. |
| **Cover & borrowing** | Research/prototype features; devnet cover terms are **not** an oracle-settled, fully reserved insurance payout. Local loan records are **not** funded lending. |

See the [repository-wide code audit](docs/REPOSITORY_CODE_AUDIT_2026-11-02.md) and [Senda × PARRALAX boundaries](docs/SENDA_PARRALAX_ONCHAIN_V1.md) for implementation details and outstanding security/verification work.

## For builders

Senda's application is built with **React, TypeScript, TanStack Start/Router and Vite**, with Solana wallet libraries, venue integrations, a separate **Go Liquify** service, Rust on-chain experiments, and read-only MCP tools.

~~~bash
npm install
npm run dev
~~~

The local web app uses port **8080**.

<details>
<summary><strong>Verification and service commands</strong></summary>

~~~bash
npm run typecheck
npm test
npm run build:dev

cd services/liquify
go test -race ./...
go vet ./...
go run .
~~~

Extra Rust/Python checks are documented in [the code audit](docs/REPOSITORY_CODE_AUDIT_2026-11-02.md). A configured build can run database migrations; do not expose private provider API keys or wallet secrets to client code.

</details>

<details>
<summary><strong>Program status, production gates and operational notes</strong></summary>

- [Repository architecture and risks](docs/REPOSITORY_CODE_AUDIT_2026-11-02.md)
- [Modules and code entrypoints](docs/MODULES.md)
- [On-chain design boundaries](docs/SENDA_PARRALAX_ONCHAIN_V1.md)
- [Wallet execution guardrails](docs/WALLET_GUARDS_STATUS.md)
- [Operator handoff](HANDOFF.md)
- [Contributor instructions](AGENTS.md)

The recorded Solana [devnet cover program](chain/devnet.json) stores policy terms only; it does not operate a funded payout pool. Current production compilation, deployed provider behavior, actual token liquidity and security review must be independently verified. A source-backed claim is not automatically a completed live transaction.

</details>

---

<p align="center">
  <img src="public/og.jpg" width="720" alt="Senda brand artwork">
</p>

<p align="center"><sub>ItsNotAILABS · <a href="https://github.com/ItsNotAILABS/Senda">github.com/ItsNotAILABS/Senda</a></sub></p>


---

## Liquify Global — fourth product (integration branch)

**Trade · Pay & Send · Agents · Liquify.** Liquify is a first-class international liquidity, stablecoin and spending-rail discovery surface, accessible at `/liquify` after merge/deployment. It organizes researched market groups (US, Mexico/LATAM, Brazil, South Korea, Nigeria, Vietnam, Philippines, Hong Kong, UAE, Singapore and Türkiye), verified code-present rail references, and unconnected regional fiat partner candidates. **A listed region or provider is not a live fiat withdrawal, card network, brokerage service or guaranteed executable quote.**

The product links to the existing on-chain route and payment screens; it does not issue cards or execute regional payouts automatically. Source of truth: [Liquify global operating notes](docs/LIQUIFY_GLOBAL.md), `src/lib/liquify-global.mjs`. Run `node --test scripts/liquify-global.test.mjs` before review. Wallet execution and settlement remain separately authorized. This feature is not live until the GitHub PR is merged and deployed.


## Liquify × real event markets (Kalshi public research)

Senda now has a **read-only event-market research workspace** at `/social/events` (after merge/deployment), linked from Liquify. It reads the existing public Kalshi market catalog and fetches fresh public Kalshi binary-contract orderbook bids for the selected ticker. It computes a **gross-only** buy-YES or buy-NO cost from actual opposing bids, capped to 1–1000 whole contracts and a user-specified research budget. The planner fails closed on stale, empty, unpriced or insufficient depth and includes five scenario families: weather, shipping, energy, macro and technology. It does **not** fake bids or simulate account balances.

Phantom's availability of Kalshi markets for eligible U.S. customers does **not** mean Senda can create Kalshi orders from a Phantom connection. Senda's integration **does not authenticate or trade on that Phantom/Kalshi session**. Trading from the research desk requires going to the official venue and using its own approved flow. A Kalshi event contract is not an insurance policy or automatic rain-out reimbursement; exact event terms and regulatory status must be checked separately. See `docs/LIQUIFY_EVENT_PRODUCTS.md` and `src/lib/event-contract-router.mjs`. 


### Phantom Predict: real wallet signature vs event order

Senda's /social/events workspace supports an actual Phantom signMessage approval for a short-lived, quote-bound **research acknowledgement**. The signature is verified in the browser against the Solana wallet public key. This is a verifiable off-chain record of reviewing an event quote, **not** a Kalshi order, deposit, fill, insurance or authorization to access Phantom's predictions session.

Eligible U.S. Phantom mobile users can open Phantom > Predict and confirm their own Kalshi orders there. Phantom's U.S. Kalshi flow includes its own account/KYC, fees, funding and exchange execution. No public Phantom Predictions third-party trading SDK is integrated in Senda. Outcome tokens created by Phantom should **not** be burned or re-routed using ordinary SPL cleanup or swap tools.

Code: src/lib/phantom-prediction-sign.ts, src/lib/phantom-prediction-intent.mjs and src/components/phantom-predict-bridge.tsx. See docs/PHANTOM_PREDICT_BRIDGE.md. Phase 2 (authenticated Kalshi order entry/portfolio): issue #32, currently NOT live.

### DFlow outcome-token routing with Phantom (approval-gated)

The event-market desk now contains **two distinct Phantom surfaces**: a real signMessage acknowledgement of read-only research, and an independently guarded on-chain **DFlow prediction trade lane**. DFlow's provider-verified outcome mints, hosted Proof verification, configured jurisdiction approval and fresh Trade API transaction are required before any real signing CTA is enabled. A signed transaction is recorded as **pending** until DFlow confirms its async order is **closed**; a Solana signature is never treated as a fill. This is not the same as connecting to your Phantom U.S. Kalshi mobile account. Production provider credentials and compliance gates are not configured by this source branch. See docs/PHANTOM_PREDICT_BRIDGE.md.


### Prediction Markets — one Senda desk, multiple real venues

**Senda Predictions isn't just Kalshi.** The Predictions / Liquify venue router in `/social/events` presents five distinct venue families: **Kalshi public books**, **Phantom Predict U.S.**, **DFlow on-chain outcome tokens**, **World Prediction Markets**, and **Polymarket**. The Kalshi public feed, Polymarket Gamma market discovery and independent Polymarket CLOB token-specific depth use actual source data, not invented odds; World and Phantom U.S. use official mobile account routes, and DFlow has a separate approval-gated Phantom-signed Solana transaction implementation. No venue is silently claimed live, funded or equivalent to another.

Phantom Cash, Kalshi balances, native Solana USDC/outcome tokens and Polymarket Polygon collateral must be modeled **separately**. Senda only compares executable venue pricing when a reviewed proof establishes identical contract rules, outcomes, cutoff, settlement and payout; similar titles are not enough. Read [Prediction Router v2](docs/PREDICTION_ROUTER_V2.md), `src/lib/prediction-venues.mjs`, and `src/lib/polymarket-catalog.ts`. This is source work awaiting PR merge and deployment.


**Polymarket depth upgrade:** choose a real Gamma-listed market, inspect the outcome token's live CLOB bids/asks, and calculate a bounded research-only buy cost from observed asks. It is not an authenticated order; fee and jurisdiction approval must be completed separately. See `src/lib/polymarket-depth.mjs` and `docs/PREDICTION_ROUTER_V2.md`.


### Prediction venue reliability hardening (Nov 6)

The stacked provider-hardening branch fixes DFlow's documented `accounts.usdc` mint shape, explicitly locks crypto dependencies used by Phantom mobile, adds browser-native Ed25519 verification for Senda research signatures, and rejects unsupported DFlow submit/multi-signature/lookup-table transactions before wallet signing. It also unlocks Senda's encrypted recovery journal on the DFlow Phantom connect path. Read [provider hardening notes](docs/PREDICTION_PROVIDER_HARDENING.md). These are source fixes pending successful full CI and authorized production wallet tests; not a claim that all live venue orders now work.


## Events V3 — Kalshi terminal & Senda Contingency Lab

Senda's native `/social/events` experience now includes a rebuilt market terminal, sourced Kalshi contract rules, YES/NO public bid-depth research, real 24H/7D/30D Kalshi candlestick history with original **reported contract-volume bars**, topic discovery, sortable market views, and a browser-local watchlist.

`/social/contingency` offers event-contract risk scenarios and independent cash-reserve planning: weather, freight, energy, macro and technology cases. The calculator uses only a fresh public-book estimate for four independent combinations of real-world loss and market settlement; it never assumes that a prediction contract pays someone's expense. **This is not insurance.** No licensed policy, premium, insurer, reimbursement guarantee or claims processing is offered.

**Phantom execution rules:** Phantom's U.S. Kalshi account is operated inside Phantom's native app; a Senda `signMessage` acknowledgement authorizes research only. The separate DFlow Solana outcome-token transaction path uses Phantom signing but remains partner/KYC/jurisdiction/program-gated and disabled by default. Senda does not reuse Kalshi public prices as guaranteed executable DFlow quotes.

Code and release rules: [docs/KALSHI_CONTINGENCY_STUDIO.md](docs/KALSHI_CONTINGENCY_STUDIO.md). Source changes are not a production activation. Require GitHub CI, browser/mobile QA, official-source verification and external approval before launch.
