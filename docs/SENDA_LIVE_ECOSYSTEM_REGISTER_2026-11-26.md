# SENDA — Live-user ecosystem, integration truth and release register
**Recorded:** 2026-11-26  
**Source baseline:** `main` at `0ff59a0c2e80033ef92dfbf72e9d4970736728cf`  
**Scope:** GitHub source inspection and open-PR metadata. The operator reports existing users. This document does **not** assert deployment uptime, user count, provider permission, verified revenue, balances, or live settlements.

## Operating doctrine: existing users are real stakeholders
Senda now must be handled as an occupied production surface, not an empty demo. **Do not** invalidate existing sessions, erase browser recovery journals or legacy wallets, change mint/recipient meaning, modify financial execution without proof, or publish success from an unverified quote or webhook. Every change needs an owner, bounded diff, test evidence, rollback procedure, incident contact and release receipt.

Source-present is not live. Existing user activity was reported by the operator, not independently measured here. Before any release, inspect the *actual deployed* build/host, user traffic, latest failed financial operations, auth/session continuity and funding/withdrawal exposure. Do not assume that a GitHub merge deploys to the active site.

### Status vocabulary
- `SOURCE`: code or interface exists in repository; operating credentials and production deployment not established.
- `WALLET-SIGNED CODE`: client-controlled on-chain signature path exists; not proof of successful user execution.
- `PILOT-GATED`: intentionally limited to approved customer/account and explicit environment controls.
- `PARTNER CANDIDATE`: researched provider with no approved transaction capability.
- `RESEARCH ONLY`: display, quote or analysis; no right to treat as order, credit, coverage, or settlement.
- `DISABLED`: no authorized production rail.
- `VERIFIED LIVE`: reserved for a deployed and observed transaction with independently checked end-to-end receipts. **None newly certified by this audit.**

## Ecosystem wiring atlas

| Lane | Source of truth | Source capability | Current evidence / missing wiring | Release posture |
| --- | --- | --- | --- | --- |
| Identity, tenancy and sessions | `src/lib/auth/server.ts`, `src/lib/auth/isolation.server.ts`, `src/lib/db.ts` | Better Auth, OAuth broker, session isolation, PostgreSQL with PGLite preview fallback | Verify actual production `DATABASE_URL`, secure cookies, tenant isolation, cross-origin behavior and retention; PGLite preview is not multiuser durable production | SOURCE; production session continuity unverified |
| Connected wallets / signing | `src/lib/phantom.ts`, `src/lib/wallets.ts`, `src/lib/wallet-execution-lock.mjs` | Phantom on-chain user authorization | Test mobile/desktop signer, replay and wrong-network paths against deployed version; never accept browser balance as custodied money | WALLET-SIGNED CODE |
| Solana USDC and SOL send | `src/lib/solana-pay.ts`, `src/lib/journaled-send.mjs`, `src/lib/tx-journal.mjs` | Real wallet-signed transfers, recovery guard, transaction confirmation | Execute small authorized chain tests, verify exact mint/ATA/recipient/raw amount, post-reload ambiguous send, failed blockhash, duplicate retry and recipient disclosure | WALLET-SIGNED CODE; no new live transaction proof in audit |
| Trade / Jupiter spot | `src/lib/jup-sign.ts`, `src/lib/jup-exec.ts`, `src/lib/quote-guard.mjs` | Jupiter swap quotes and Phantom-signed execution | Remaining legacy Lite/public endpoints in `jup-sign.ts`; verify provider API availability/auth, slippage/fee source, quote freshness, exact input amount, send receipt, no double execution on retry | WALLET-SIGNED CODE; provider freshness not certified |
| Perpetuals / venue execution | `src/lib/jup-perp-api.ts`, `src/lib/jup-perps.ts`, other venue-specific modules | Jupiter perps position create/close interfaces | Confirm current endpoint/permissions, margin collateral and liquidation semantics, exact venue eligibility, executed order status, portfolio matching and exposure limits | SOURCE; execution verification required |
| Prediction markets | `src/lib/kalshi-book.ts`, `src/lib/kalshi-link.ts`, `src/lib/dflow.ts`, `src/lib/kalshi-depth.ts` | Public Kalshi data, provider-specific order and quote code | Kalshi server function accepts user-supplied private PEM; require a dedicated credential/security review, approved user jurisdiction/venue consent, rate limits, real order status and retrieval. DFlow routes depend on partner API/access and wallet signatures | MIXED SOURCE / RESEARCH; unverified live user orders |
| Liquify research/quotes | `src/lib/liquify-global.mjs`, `services/liquify/v2.go`, `services/liquify/README.md` | International registry and read-only Go multi-source observations | Some sources share underlying pools; do not double count. Private ingress, provider keys, token mint validation, rate limits, quote freshness, infrastructure monitoring and Go race tests still needed | SOURCE / RESEARCH |
| Mexico / Bitso | `services/bitso-business/`, `src/lib/liquify-global.mjs`; PR #63 | Read-only Trading API/HMAC components on main; signed webhook/inbox/worker proposed in PR #63 | Enterprise KYB/MXN corridor, official account-level FX contract, supported Solana USDC funding and SPEI payout, durable migration, webhook test and independently settled bank receipt absent | PARTNER CANDIDATE; fiat payout DISABLED |
| Friendly transfers and funding | `src/components/friends-money-desk.tsx`, `src/lib/money-settlement-core.mjs`, `src/routes/api/money/webhook.ts` | Wallet USDC transfer and provider settlement contract; generic signed webhook | Generic settlement processor not connected; source asserts no processor funding intent creator. Need approved settlement provider, user-specific ledger, reconciliation, refunds, KYC and dispute workflow | WALLET-SIGNED CODE / fiat DISABLED |
| Bridge bank virtual accounts | `src/lib/receive-account.ts`, `src/lib/receive-account-auth.mjs` | Explicit signer and session challenge; limited Bridge customer | Single approved customer gating, not multitenant customer/account mapping. Check bank partner and compliance before broad activation | PILOT-GATED |
| Cards and merchants | `src/lib/card-issuing.ts`, `src/lib/card-rails.ts`, `src/lib/card-protocol.ts`, `src/lib/paper-money-policy.mjs` | Card concept, wallet payment links, issuer candidate links | Locally generated PAN/CVV is **not** a Visa/Mastercard product. Confirm all simulated card/bank paths are absent from public money claims. Need issuer/card program and regulated account permissions | RESEARCH / issuer DISABLED |
| Cross-chain movement | `src/lib/lifi.ts`, `src/lib/cctp.ts`, `src/lib/cctp-send.ts` | LI.FI quotes, Circle CCTP v2 burn/attestation source | Verify destination network, chain token contracts, fees, attestation, finality, fraud/route simulation, replay and recovery; source code is not proof of completed destination mint | SOURCE; route-by-route verification |
| PARRALAX finance/risk | `integrations/parralax-finance/`, `integrations/parralax-trading/`, `integrations/parralax-security/` | Server-side risk adapter, encrypted evidence contract | Real separate PARRALAX service origin/keys, tenant policies, durable authority, KMS-managed envelope keys, oracle evidence, risk approval and operator incident controls not verified | SOURCE / PARTIAL |
| Agent governance | `src/lib/agent-approval.mjs`, `src/lib/agent-workspace.ts`, `src/lib/agent-live.ts`, `src/components/live-agent.tsx` | Agent proposals, wallet review and legacy recovery | **P0:** browser-local legacy agent private key remains readable for withdrawal; fund-old-address control exists. Preserve funded-wallet recovery, but stop recommending new funding to browser-key accounts. Never silently delete local keys | SOURCE; autonomy cannot sign unattended |
| Cover and collateral | `src/lib/cover-chain.ts`, `src/lib/lend.ts`, `chain/devnet.json` | Browser-key legacy cover account and local loan records; devnet cover terms | **P0:** legacy cover key in localStorage, source premium/cancellation path; no licensed reserve-backed insurance/secured loan. Preserve recovery and segregate dev/paper balances from real assets | RESEARCH / regulated features DISABLED |
| Treasury and onchain programs | `integrations/parralax-treasury/`, `chain/` | Intent/IDL source, read-only verification and devnet-oriented material | PARRALAX treasury contract not verified deployed to devnet, not audited, no approved remote signer/actual budget enforcement | SOURCE / not deployed |
| Event Intelligence / SendaPay bridge | `services/event-intelligence/`, `integrations/sendapay/event-intelligence-client.mjs` | Extracted research-only Kalshi event API, server-side client | No verified deployed service URL or accepted SendaPay financial integration. Separate auth/rate limits, tenant controls, quota, signed data provenance needed | SOURCE / RESEARCH |
| External provider catalogue | `integrations/open-source/catalog.json`, `config/solana-ecosystem-scout.json` | Research inventory; candidate integration discovery | Provider listing must not enable execution; require source license/security review, contracted access, receipts and production owner | RESEARCH |
| Release, operations, CI | `docs/RELEASE_CERTIFICATION_2026-11-26.md`, `scripts/release-certify.mjs`, issue #55 | Fail-closed source certification script and test inventory | GitHub Actions jobs fail before assignment (runner_id=0, steps=[]). Independent deployed-host status, real wallet smoke receipts, rollback and error budgets are not certified. Branch ruleset not verified | BLOCKED |

## High-priority live-user risks and change order

### P0: operator and financial continuity
1. **Runner / branch protection:** fix runner provisioning or billing (GitHub issue #55), require checks/reviews and protection. No stale PR may bypass this just because GitHub displays "mergeable".
2. **Login + database continuity:** verify production auth secret and durable SQL backing; no public fallback to dev-user/PGLite. Verify no migration wipes existing users, wallets, journals, or settlements.
3. **Legacy browser keys:** `src/lib/agent-live.ts` and `src/lib/cover-chain.ts` can access locally persisted secret keys; this is a browser compromise/XSS risk, not evidence of compromise. Do not erase keys while users may have funds; introduce explicit recovery/withdraw guidance and deny new deposits to legacy browser-key products after QA.
4. **Kalshi private key handling:** `src/lib/kalshi-link.ts` receives a user's PEM in a server function. Prefer short-lived managed venue credentials or signing boundary with tenant isolation; security review before additional rollout. Never log or persist raw keys.
5. **Payment correctness:** enforce authoritative Solana confirmation, recipient/mint/amount matching, cross-device recovery and durable provider ledger before claiming bank/card delivery. A wallet signature is not a fiat settlement.
6. **Provider health:** rate limit and quota by tenant and provider, record error rates/latencies, source freshness, quote age and degraded mode. Do not retry ambiguous money writes automatically.

### P1: partner product wiring
7. Prioritize a *provider adapter contract*: credentials and entitlement -> funding instructions -> fresh executable quote -> exact consent -> wallet signature -> provider receipt -> reconciliation -> dispute/return.
8. Implement Bitso/Bridge/card/venues behind separate capability gates; provider readiness must be validated server-side for each account, geography and instrument. Keep MXN bank payout, card issuance, underwritten cover, and uncollateralized loans off until approved.
9. Separate research/event market APIs from execution; verify Kalshi, DFlow and other partner identity/jurisdiction restrictions with vendor contracts and real receipts.
10. Wire PARRALAX authority to durable allowance reservation, exchange-specific risk checks and independent execution evidence; agent-generated assertions cannot substitute for provider attestations.

### P2: improvements after stability
11. Multi-venue market data freshness, liquidity attribution without double counting, instrument identifiers, non-executable quote labels, API-cached read-only discovery.
12. Cross-device history, reconciliation user support, refund resolution, incident analytics, per-tenant SLO dashboards and rollout feature flags.

## Current open PR disposition (audited 2026-11-26)
- [#45](https://github.com/ItsNotAILABS/Senda/pull/45) — conflicts with main; prior cherry-picked code means full merge can revert fixes. Reconcile missing non-risky hunks only.
- [#46](https://github.com/ItsNotAILABS/Senda/pull/46) — conflicts; event-market changes selectively landed on main already. Avoid replacing live event desk.
- [#51](https://github.com/ItsNotAILABS/Senda/pull/51) — technically mergeable into `feature/kalshi-markets-contingency-20261113`, **not main**; its CI is failing. Not a safe production promotion.
- [#52](https://github.com/ItsNotAILABS/Senda/pull/52) — draft and conflicting; agent security components selectively landed on main. Do not merge stale branch.
- [#63](https://github.com/ItsNotAILABS/Senda/pull/63) — draft, mergeable but checks fail; adds a new webhook ingress and DB schema. Require independent security review, real DB integration tests, event signature fixtures, provider staging access and rollback before merge.
- [#55](https://github.com/ItsNotAILABS/Senda/issues/55) — existing release administration blocker.

**Decision:** As of this inventory, no pre-existing financial or market PR meets the production release gate. A source-only merge is not worth breaking active users.

## Release protocol for any subsequent change
1. Capture exact production host, deployed artifact and currently running commit; compare to branch head. Source merge is not deploy verification.
2. Establish current live baseline: login, wallet connect, on-chain send, pending/recovery status, trade quote/sign, latest known user-facing errors and partner availability.
3. Break work into small reversible PRs, favoring additive read-only/source-only changes and flags that default OFF. Reject database destructive migrations, changing wallet keys/mints, implicit auto-signing and global CSS/route replacement without explicit review.
4. Run `node scripts/release-certify.mjs` plus focused tests/negative cases, TypeScript build, Go Liquify race/vet, integration staging, mobile wallet QA, and at least one operator-approved transaction where necessary. Record exact output and failures. No bypass for unavailable runners.
5. For any real-money route: compliance/partner approval, test in stage, tenant/entitlement guard, exact quote and fee disclosure, signed intent, idempotency and event replay, settlement reconciliation and rollback/refund playbook.
6. Deploy by staged flag/canary, observe API 5xx, quote latency, wallet rejection, pending ambiguity, provider errors and receipt mismatches. Stop if error budget exceeded; revert feature flag first.
7. Capture release receipts, incident owner, support escalation, migrations and backout procedure. Never represent the full release as verified based solely on unit tests.

## Important audit limitations
This is static source and GitHub metadata inspection. No authenticated production monitoring, wallet balance, transaction execution, venue permissions, cloud infrastructure credentials, end-to-end app build or complete penetration test was available or performed. The live site was not independently accessible from the inspection environment. Do not claim any end-to-end LIVE certification from this register.
