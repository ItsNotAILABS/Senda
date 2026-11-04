# Senda Prediction Routing v2 — five venue families, one user experience

## Product architecture

Prediction markets are **a core Senda desk feature**, not a single-provider launch. Product modules are Trade, Pay & Send, Agents and Liquify, with Predictions using Liquify venue capabilities. The entry point is `/social/events`. It now selects independent execution/research venues:

| Venue | Current source path | Actual execution authority | Funding and settlement |
|---|---|---|---|
| Kalshi public | Kalshi public event catalog + opposing bid orderbook | Public research only; separate account API approval required | Exchange account; not automatically a Phantom wallet |
| Phantom Predict US | Official Phantom mobile app | Phantom's own in-app authorization; no public third-party Predictions SDK | Cash or supported Solana tokens; Kalshi operates event rules and account obligations |
| DFlow outcome tokens | Provider market metadata, proof/eligibility and approved Trade API, gated | The connected Solana wallet signs provider-verified transactions after mandatory checks | Native Solana USDC to outcome token; DFlow asynchronous order status and settlement |
| World Prediction Markets | Official Phantom mobile app; no connected independent Senda API | Phantom's own supported in-app route, only where offered | World protocol; Phantom mobile manages positions and CASH payouts where supported |
| Polymarket | Public Gamma catalog, `GET /markets` | Research only; authenticated CLOB, collateral and jurisdiction integration not connected | Venue-specific Polygon collateral, separate from Solana wallets or Kalshi |

The **U.S. Phantom user experience** is our product standard: integrated funding, few-tap contract selection, current quote/fees, explicit approval and in-app position tracking. The architecture must not assume Senda can read or reproduce Phantom's private trading session. See: https://help.phantom.com/articles/56546828429587 and https://help.phantom.com/articles/47187740851731.

## Canonical code

- `src/lib/prediction-venues.mjs`: unified source/venue capability table; normalization, eligibility gating, and explicit market equivalence contracts.
- `src/components/prediction-venue-router.tsx`: five-venue selector, source/funding/settlement badges and honest status.
- `src/lib/kalshi-book.ts`, `src/lib/kalshi-depth.ts`: public Kalshi research and sourced orderbook, no execution.
- `src/lib/dflow-predictions.ts`, `src/lib/dflow-prediction-sign.ts`, `src/lib/dflow-prediction-receipt.mjs`: private producer/Proof, mandatory wallet signing and asynchronous fills. Still disabled by default until approved credentials and compliance services operate.
- `src/lib/polymarket-catalog.ts` / `.mjs`: public Polymarket Gamma feed. Published outcomePrices are **indicative catalog values, not executable CLOB quotes**.
- `src/components/event-markets-desk.tsx`: unified shell that renders venue-specific market sources and avoids presenting Kalshi markets as World or Polymarket quotes.

## Genuine venue routing design

A comparable market requires **a reviewed equivalence proof**, not a title match. The proof must include both exact venue IDs and market IDs, contract rules hash, identical cutoff, settlement basis, payoff and a fresh sign-off. Without that evidence the Liquify router may show two apparently similar event names but must never claim equivalent contracts, cross-venue arbitrage, or a better executable price.

Future connectors must implement these explicit stages: `discover`, `readMarketRules`, `fetchIndicative`, `getExecutableQuote`, `validateIdentity`, `authorizeSpend`, `signOrApprove`, `submit`, `pollStatus`, `reconcilePosition`, `redeem`. A single venue may support read-only stages but **must not advertise signing** until all approvals, eligibility and total fee disclosures are verified.

The router scores only eligible, independently sourced executable offers with verified market equivalence. Useful metrics: amount, quote age, available depth, total costs including fees, slippage guard, custody model, chain/issuer exposure, partial-fill semantics, settlement and refund recovery. For non-comparable venues show data separately; never multiply a Kalshi market price by a Polymarket token amount to claim an arbitrage.

## Funding and Cash

Do not conflate Phantom Cash with user-held USDC or automatically assume all funding is direct on-chain. In Phantom's supported U.S. flow, Cash-funded trades may be gasless, while portfolio token-funded trades may require SOL for transaction fees. Settlement and account services operate through Phantom/Kalshi. In DFlow, USDC is wallet-signed on Solana and outcomes can be represented by tokens, with separate CLP execution and redemption. In World, eligible users see Phantom's mobile-native support and CASH payouts. Polymarket is a distinct Polygon collateral system.

A Phantom wallet signature alone is not a Kalshi exchange API credential, and a signed DFlow transaction is not proof that the CLP filled it.

## Release status

This feature is code on a branch; not a deployed Senda prediction product. Kalshi and Polymarket read-only provider catalogs are implemented, DFlow is separately eligibility-gated, and Phantom US/World are official mobile flows. **No agent has placed a wager, registered an account or moved funds.** Production sign/settle needs end-to-end testing, privacy and compliance, provider authorization, full TypeScript build, wallet mobile QA and audited funding/claims.

Tests:

```bash
node --test scripts/prediction-venues.test.mjs scripts/polymarket-catalog.test.mjs
npm run typecheck
npm run build:dev
```
