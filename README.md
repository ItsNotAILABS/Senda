<p align="center">
  <img src="public/banner.jpg" alt="Senda" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/BYOW-bring%20your%20own%20wallet-d6ff4a?style=flat-square&labelColor=111111" alt="Bring Your Own Wallet">
  <img src="https://img.shields.io/badge/control-you%20sign-111111?style=flat-square&labelColor=14F195" alt="Wallet signed">
  <img src="https://img.shields.io/badge/markets-multi--venue-111111?style=flat-square" alt="Multi-venue desk">
  <img src="https://img.shields.io/badge/pay-USDC-111111?style=flat-square" alt="USDC payments">
  <img src="https://img.shields.io/github/last-commit/ItsNotAILABS/Senda?style=flat-square&color=111111" alt="Last commit">
</p>

<h1 align="center">SENDA — Bring Your Own Wallet.</h1>
<h3 align="center">Your wallet is the account. Senda is everything you can do around it.</h3>

<p align="center">
  Bring the wallet you already control. Trade across supported markets, swap, move USDC, review your portfolio, research liquidity, explore tokenized assets, and work with bounded AI agents — without surrendering your wallet's signing keys to Senda.
</p>

<p align="center">
  <a href="https://senda.pocketnova.app">Open Senda</a> ·
  <a href="#the-senda-products">Explore the products</a> ·
  <a href="#how-byow-works">How BYOW works</a> ·
  <a href="#run-and-verify">Build and verify</a>
</p>

<p align="center">
  <a href="public/video/desk.mp4"><img src="public/cover.jpg" width="49%" alt="Senda multi-market desk"></a>
  <a href="public/video/card.mp4"><img src="public/images/metal-card.jpg" width="49%" alt="Senda payment and card experience concept"></a>
</p>

**One wallet. A wider financial world.** Senda is a wallet-native workspace, not merely a PreStocks trading page. It brings together trading, liquidity intelligence, payments, financial tools, agents, and interactive market experiences. Some flows are live wallet-signed code; other views are research, browser-local prototypes, or integrations that require credentials and provider access. Those differences are explicit below.

## How BYOW works

1. **Connect yours.** Senda discovers the wallets installed in your browser or opens supported mobile wallet experiences. The connector reads public addresses; it does not require a seed phrase.
2. **Choose your lane.** Explore Solana markets, tokenized instruments, supported EVM venues, payments, or research. A price feed is not an execution quote.
3. **Inspect the transaction.** For supported actions, Senda requests a venue quote, enforces application limits and presents the route or amount. Provider availability, network, mint, and eligibility matter.
4. **You approve.** Your wallet signs. Senda does not sign with your Phantom, Solflare, Backpack, MetaMask, or other linked-wallet private keys.
5. **Verify the result.** On-chain transaction status is authoritative. A broadcast signature, historical candle, card-shaped UI, or browser-local balance is not proof of final settlement.

**Wallets represented in the code:** Phantom, Solflare, Backpack, Glow, OKX, Bitget, Trust, and Coinbase on Solana; MetaMask, Rabby, Coinbase Wallet, and Brave on EVM. Actual availability depends on an installed provider, its signing methods, and the selected chain. A linked EVM address is not interchangeable with a Solana wallet for SPL transfers or Jupiter swaps. See [wallet detection](src/lib/wallets.ts), [wallet signing](src/lib/phantom.ts), and [wallet interface](src/components/wallets-desk.tsx).

## The Senda products

| Product | What it brings together | Source of truth / boundary |
| --- | --- | --- |
| **Wallets & Portfolio** | Bring your own Solana or EVM wallet, inspect connected addresses, token holdings and account positions. | Chain reads and wallet providers for on-chain assets; browser-local account tools are separate. [Wallets](src/lib/wallets.ts) · [Portfolio](src/components/vault-desk.tsx) |
| **Trade & Swap** | Explore Solana assets; request Jupiter swap quotes; sign buy, sell, and conversion transactions from the wallet. | [Jupiter signing](src/lib/jup-sign.ts), [quote guard](src/lib/quote-guard.mjs), [transaction journal](src/lib/tx-journal.mjs). A quote is not a fill. |
| **Multi-market trading** | Solana spot, liquid-staking assets, xStocks, PreStocks and venue-specific perpetual/spot interfaces, including Jupiter Perps, Hyperliquid, Ostium, and supported LI.FI EVM routes. | Each venue has separate accounts, contract rules, network support, liquidity, eligibility, and approval. [Jupiter Perps](src/lib/jup-perps.ts) · [Hyperliquid](src/lib/hl-sign.ts) · [Ostium](src/lib/ostium-trade.ts) · [LI.FI](src/lib/lifi.ts) |
| **Liquify** | Indicative Jupiter quote-size ladders and a standalone read-only Go router. Compare route availability by actual mint and size instead of pretending historical volume is executable depth. | [App adapter](src/lib/liquify.ts) · [Go router](services/liquify/README.md). **Quote and analytics only**, not a Senda order book, market maker, or swap signer. |
| **Market Intelligence** | Source-led price, liquidity and volume research, GeckoTerminal pool candles, quality checks, relative-volume analysis, and Solscan-indexed swap observations. | [Research screen](src/components/market-intelligence.tsx) · [volume methodology](docs/native-solscan-volume.md). Historical flow is not an executable order; unavailable data stays unavailable. |
| **Pay, Send & Move** | Wallet-signed Solana USDC transfers, SOL and token payments, Solana Pay links, payment requests, and chain-route exploration. | [Solana payment builder](src/lib/solana-pay.ts). LI.FI bridge and Mexico-oriented transfer views are provider/network dependent; Senda does not itself settle bank payouts or MXN cash withdrawals. |
| **AI Agent & Utility AI** | Local bounded workers, research briefs, proposed/queued actions, evidence-led market/liquidity analysis and optional server-configured model interpretation. | [Agent workspace](src/lib/agent-workspace.ts) · [Utility AI](src/lib/utility-ai.ts). Agents cannot independently sign a wallet transaction; optional model access is configuration gated. |
| **Genesis** | Six character-based research runtimes, gear and loadout concepts, asset ownership lookup, and research outputs. | [Genesis runtime](src/lib/genesis-runtime.mjs) · [ownership verification](src/lib/genesis-chain.ts). Collectibles/entitlements are not assumed minted or verified without an actual configured chain registry. |
| **PreStocks & xStocks** | Tokenized pre-IPO economic exposure and tokenized listed-equity market discovery beside the wider crypto desk. | [PreStocks/Tessera book](src/lib/sol-house.ts) · [xStocks/Kamino research](src/lib/equities.ts). Tokens are not automatically direct corporate shares, voting rights, redemption rights, or dividends. |
| **Work & Make** | USDC-priced services, local work listings, payment links, and wallet-signed transfers to participating addresses. | [Work jobs](src/lib/work-jobs.ts) · [Make board](src/lib/make-board.ts). A listing or signed transfer is not proof of escrow or delivery. |
| **Play & Predict** | Print-driven games, market ideas, and practice experiences with a separate local ledger. | [Game interface](src/components/play-ten.tsx) · [guest ledger](src/lib/guest-stack.ts). Browser cash/chips are not a funded on-chain gambling or payout service. |
| **Cover, Pockets & Finance Lab** | Protection-term experiments, time/condition pockets, loan concepts, derivative research and controlled-value flows. | [Cover program](chain/senda-program/src/lib.rs) · [pockets](src/lib/pocket-contract.ts) · [loan prototype](src/lib/lend.ts). **Not** an audited mainnet insurance product, funded lending pool, or guaranteed payout. |
| **Cards & Spending** | Card-management interfaces, local checkout limits, wallet payments, and optional server-side Mastercard Commercial Connect functions. | [Card UI](src/components/cards-desk.tsx) · [Mastercard adapter](src/lib/mastercard-vcn.ts). Locally generated desk numbers are **not** scheme-cleared payment cards. Provider issuance requires separate configuration and authorization. |

<p align="center">
  <img src="public/images/hero.jpg" width="49%" alt="Senda wallet-first experience">
  <img src="public/images/markets-desk.jpg" width="49%" alt="Senda multi-market interface">
</p>

## The four connected layers

**01 · Wallet.** The user's existing wallet is the signing and on-chain ownership boundary. Senda offers discovery, review and transaction composition without taking over wallet signing.

**02 · Markets.** Multiple source feeds and venue-specific execution adapters coexist in one desk. Jupiter handles Solana swap paths; supported EVM markets use their own wallet and venue flows. No single price print is promised as tradeable inventory.

**03 · Money movement.** Solana USDC can move via wallet-signed SPL transfers. Other routes, card issuance, bridging and fiat destinations require their real providers; availability is not inferred from a visible interface.

**04 · Intelligence.** Liquify, Matrix, Genesis, MCP and Utility AI observe data, generate research or draft bounded actions. They do not silently elevate themselves to transaction-signing authority.

<p align="center">
  <img src="public/images/orbit.jpg" width="49%" alt="Senda discovery and intelligence concept">
  <img src="public/images/term-sheet.jpg" width="49%" alt="Senda research and terms concept">
</p>

## Status: what is code, what is funded, what still needs a provider

| Status | Current boundary |
| --- | --- |
| **WALLET-SIGNED CODE** | Solana quote/swap construction, wallet approvals, on-chain USDC payment paths, transaction confirmation and recovery logic are implemented. External RPCs, wallet adapters and live provider responses still need verification for the deployed environment. |
| **MULTI-VENUE INTEGRATIONS** | EVM route, Hyperliquid, Ostium, Jupiter Perps and xStocks/Kamino source adapters exist. Execution is only possible where the actual network, quote, account, permissions and venue conditions allow. |
| **READ-ONLY / CONFIGURATION-GATED** | Go Liquify, Solscan Pro volume, Genesis asset ownership, AI model interpretation and Mastercard Commercial Connect require their respective services, credentials, registry or other setup to make all functions usable. |
| **DEVNET** | Senda records cover *terms* in an identified Solana devnet program. It does not reserve funded USDC protection payouts, validate an on-chain price oracle, or create a general mainnet lending protocol. |
| **BROWSER-LOCAL / PROTOTYPE** | Senda cash, locally created desk numbers, practice bankrolls, some job/loan records, and selected conditional pockets are not the same as external cash, scheme-cleared cards or on-chain credit. Some pocket/game-pot flows use device-held keys; review their backup and custody risks before funding them. |
| **NOT VERIFIED AS DEPLOYED** | Successful end-to-end current CI, authenticated market feeds, audited cover settlement, bank/MXN off-ramp, production card issuance, or autonomous on-chain agent spending are not established merely by this source repository. |

The code deliberately separates a **verified wallet signature** from a **wallet balance**, a **price print** from an **executable quote**, a **research agent** from a **signing key**, and a **browser-local feature** from a **real financial institution**. See the [repository architecture audit](docs/REPOSITORY_CODE_AUDIT_2026-11-02.md) for exact source files and remaining validation gates.

## More than PreStocks: the market universe

The [instrument catalog](docs/OFFERINGS.md) and [CSV](docs/offerings.csv) preserve a **dated October 21, 2026 snapshot** of 5,105 classified entries across tokenized names, verified Solana spot, staking assets, listed tokens, perpetual venues, EVM spot, native-chain prints, and service rows. That is a catalog snapshot — **not** a live count of currently executable positions, funded markets, or unique issuer permissions. Always request current provider data and a fresh route before trading.

Senda's pre-IPO instruments represent tokenized economic exposure, not automatically corporate equity. Eligibility, offer restrictions, issuer terms, jurisdiction, secondary transferability, and redemption mechanics can differ. Review each instrument's documents rather than treating a token mint as a brokerage security.

## How Senda fits the ecosystem

| Layer | Technologies and integrations in the repository |
| --- | --- |
| **Web application** | React 19, TypeScript, Vite, TanStack Start/Router, Tailwind CSS |
| **Wallet & on-chain** | Solana wallet providers, @solana/web3.js, SPL transfers, wallet-bound Jupiter swap signing, EVM wallet methods |
| **Markets** | PreStocks, Tessera, Jupiter, xStocks/Kamino, GeckoTerminal, Solscan, Hyperliquid, Ostium, LI.FI, public event-market feeds |
| **Liquidity intelligence** | Native Go quote and swap-volume service, server-side research adapters, short-lived source caches |
| **AI & agents** | Bounded local agent workers, deterministic market rules, optional server-side model narration, read-only MCP |
| **Storage & identity** | Browser-local state; wallet-signature-derived encryption in selected flows; Better Auth, Postgres/Neon or PGlite where configured |
| **On-chain research** | Rust and Python payment/cover-memo tools; Solana devnet terms registry; PARRALAX governance boundary documented separately |

The read-only [Senda MCP](mcp/README.md) exposes market observation, quote, payment-link and public-address tooling. It cannot sign for the user. The [Senda × PARRALAX on-chain specification](docs/SENDA_PARRALAX_ONCHAIN_V1.md) describes governance and escrow proposals — not a deployed funded insurance or agent-budget program.

### Devnet cover reference

- Cluster: **Solana devnet**, not mainnet-beta.
- Program: [4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta](https://explorer.solana.com/address/4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta?cluster=devnet)
- Deployment transaction recorded in [chain/devnet.json](chain/devnet.json).
- Program behavior: record immutable cover terms for a wallet/market symbol, subject to its current one-record constraint. **It does not hold reserves or execute payouts.**

## Run and verify

    npm install
    npm run dev

Open the local app on port **8080**. For validation:

    npm run typecheck
    npm test
    npm run build:dev

Optional standalone Liquify service:

    cd services/liquify
    go test -race ./...
    go vet ./...
    go run .

Additional on-chain and cross-language checks:

    cargo test --manifest-path chain/senda-chain/Cargo.toml
    cargo test --manifest-path chain/senda-program/Cargo.toml
    PYTHONPATH=chain/python python3 -m unittest discover -s chain/python/tests

The web app's build process may run database migrations when configured. Go Liquify, Solscan, third-party cards, and model narration need their own **server-side** configuration; never put private API keys, a seed phrase, card PAN/CVV, or device-held pocket keys in the Git repository.

**Verification status:** source architecture reviewed at the repository head referenced in the audit. A successful app build, green GitHub Actions run, live trade, live card issuance, or live payout was **not** established by this documentation change.

## Work on Senda without breaking the desk

Start with [AGENTS.md](AGENTS.md), [architecture modules](docs/MODULES.md), the [code audit](docs/REPOSITORY_CODE_AUDIT_2026-11-02.md) and [current integration receipts](docs/merge-reconciliations/PR-11.md). Preserve the existing Senda interface, connected-wallet signing, confirmed-transaction recovery, real asset provenance and source-status labels.

Do not replace the app with a demo, report browser cash as bank funds, suggest unverified card numbers can clear merchants, or call a quote, memo, or devnet account a finished financial product.

<p align="center">
  <img src="public/og.jpg" width="720" alt="Senda">
</p>

<p align="center"><sub>ItsNotAILABS · <a href="https://github.com/ItsNotAILABS/Senda">github.com/ItsNotAILABS/Senda</a></sub></p>
