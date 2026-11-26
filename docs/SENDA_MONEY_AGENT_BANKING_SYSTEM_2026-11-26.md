# SENDA · Money for people, governed accounts for agents
## Product and architecture release contract — 2026-11-26

**North star:** one wallet-native money app for people and a programmable spending/accounting layer for agents, anchored in the working Senda desktop/mobile Phantom execution flow. **Do not replace or reset that flow.** The founder reports real-money Phantom swaps and sends, totaling over $1,000 of observed personal trading/sending activity; independent transaction receipts are not attached to these release notes, so this is operator-reported production usage, not a certification of every route.

Senda may offer a neobank-like experience, but it is **not a licensed bank**, FDIC-insured deposit institution, card issuer, or guarantee of access to fiat rails. Any true banking accounts, ACH, debit cards, wire, SPEI, custodial balances, deposits or insurance require licensed partners, agreements, compliance and verified technical integration.

### Two connected account models

| Consumer Money | Agent Money |
| --- | --- |
| Bring your own Solana/EVM wallet; discover holdings and supported tokens. | Owner creates a **separate**, bounded on-chain PARRALAX treasury when a verified program is deployed. |
| Swap with wallet approval; send USDC with a real signed transaction. | Agent proposes a specific USDC service payment, with policy and recipient restrictions. |
| Show consistent Activity, pending/confirmed/rejected receipts, source and network. | Treasury verifies agent identity, mint, allowlist, per-tx/daily/lifetime budgets and nonce on-chain. |
| Collect payment requests, QR, contacts and provider-supported bridges. | Owner/guardian can pause, revoke, change limits or rotate agent. |
| Clearly separate on-chain USDC from cards, fiat deposits and unconnected payment rails. | No private key in the browser, model context or logs; isolated agent signer only after security review. |

### Operational path, not a simulation

**User:** wallet connect → balance/source → quote or recipient → explicit wallet approval → signed tx → confirmation/finality → post-confirmation balance/receipt → durable activity.

**Agent (when on-chain program is deployed):** owner-signed treasury creation → owner-funded vault → authenticated service request → deterministic policy review → current program/treasury account verification → nonce/cap/recipient enforcement by audited program → isolated agent signer submits exact instruction → confirmation and SPL transfer verification → immutable ledger receipt → optional service fulfillment evidence.

The model cannot enlarge its budget, edit the owner-signed policy, approve its own transaction, or turn a read-only event signal into a permission to spend.

### Integrated source on main and tracked follow-ups

1. `services/event-intelligence/src/event-risk-intelligence.mjs`: checks matching Kalshi ticker provenance, venue state, close time, freshness, two-sided bid depth, crossed books, rule availability, and candle coverage. No invented probabilities, orders or insurance.
2. `GET /v1/intelligence/:ticker?window=24h|7d|30d`: **server-authenticated**, read-only quality evidence with the existing non-executable response digest contract. SDK and SendaPay server-only adapter method included.
3. **Draft PR #69, not merged:** `src/components/event-evidence-strip.tsx` adds a narrow source-quality/market-depth strip to Events V3. Awaiting application build and device smoke tests; current production UI is unchanged.
4. `integrations/parralax-treasury/agent-money-policy.mjs`: scope, recipient allowlist, expiration, exact minor-unit caps, pending obligations, request replay and nonce validation. **Review-only**, canExecute=false. Supplied state is *not* a trusted ledger unless independently verified.
5. `integrations/parralax-treasury/agent-account-read.mjs`: server-side chain-backed read model; checks pinned genesis, program owner, PDA seeds, token-program owner, ATA mint and exact u64 amount. It **does not** sign, submit, reserve funds or establish a bank account.
6. New negative/positive Node tests; existing event and PARRALAX CI workflows updated to include their relevant tests.

### Current reality ledger

| Feature | Status | Evidence or limitation |
| --- | --- | --- |
| User Phantom swaps and USDC sending | **PARTIAL (operator-used)** | Founder reports repeated real funds movement; no independent sample signatures supplied in these release notes. Preserve existing wallet and money UI. |
| Live event research / Kalshi public book | **PARTIAL** | Public-source adapters, independent history, rules, book and data-quality views. Live provider contract verification needed. |
| Standalone Event Intelligence service | **PARTIAL** | Vercel READY preview previously observed; server credentials and authenticated runtime tests not yet certified. |
| Event probabilities/insurance/prediction order execution | **NOT CONNECTED** | No authorization or payout capability added by the integrated code. A prediction market is not insurance. |
| Agent PARRALAX treasury | **PARTIAL** | v2 localnet/client source exists; no independently verified devnet/mainnet deployment or audit. New read model fails closed without pinned program/genesis. |
| Bank deposits, card funding, SPEI payouts | **NOT CONNECTED** | Requires real licensed providers and receipts; never backfilled from browser cash or local desk cards. |
| Agent automatic spending | **NOT ENABLED** | Review and chain read only; no signer/permission activation. |
| Tests and release | **PARTIAL** | Source tests added and workflows updated, but clean CI, full app build, desktop/mobile hardware-wallet tests and deployed service validation must be evidenced. |

### Staged completion plan

**Stage 1 — make the existing consumer money app dependable:** restore CI, verify release builds, log provider failures and transaction life cycle, reconcile on-chain balances vs browser activity, and test mobile Phantom with sample real signatures. Improve the existing Money/Pay UI incrementally, without changing navigation or creating a fake account system.

**Stage 2 — agent-account read plane:** register signed policy owners and service identities, require a pinned program+genesis and authenticated RPC, expose chain-backed balances, caps, expiration, paused/revoked status and history to approved backends. Use Senda service gateway and persistent tenant/audit storage; never client-supplied balances.

**Stage 3 — PARRALAX execution plane:** independent program security review, verified devnet deploy, owner-signed vault funding, real tx receipts, guardian/revocation drills, tested failed/replayed/double-spend attempts, isolated signer, durable reservation ledger, idempotent settlement and reconciliation. Mainnet only after measurable gates.

**Stage 4 — optional regulated banking:** partner agreements for fiat deposits, ACH/SEPA/SPEI, virtual/physical card issuance, FX corridors, screening and compliance. Mark unavailable capabilities as unavailable until live partner contracts and transactions exist.

**Stage 5 — agent commerce network:** services advertise pricing, recipient/mint, SLA and evidence; agents can only pay through a policy-verified PARRALAX vault after explicit owner delegation. Event Intelligence can propose alerts and scenarios but cannot issue transfers, deposits, orders or insurance.

### Required verification commands

```bash
cd services/event-intelligence && npm ci && npm test && npm run build
cd ../..
node --test integrations/parralax-treasury/agent-money-policy.test.mjs
node --test integrations/parralax-treasury/agent-account-read.test.mjs
npm run typecheck
npm run build:dev
```

**Production promotion requires** authenticated Kalshi source tests, no client-side event keys, verified chain account/mint/decimals, exact receipt accounting, adverse RPC/quote failures, on-chain program review, functional CI, and no regression to the existing user-paid Phantom flows. Source-only review and devnet/localnet tests are not mainnet certification.
