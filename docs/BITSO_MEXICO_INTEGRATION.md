# Senda Liquify: Bitso Business Mexico corridor readiness
Research/implementation date: 2026-11-25. Operational state: **CANDIDATE / NOT CONNECTED**.

## Verified public interface matrix

| Stage | Verified public Bitso capability | Senda implementation / blocking requirement |
| --- | --- | --- |
| Onboard | MXN SPEI for business accounts; non-Mexican institutional clients must activate MXN in Bitso web UI; Level 1+ required. No activation API. | Commercial agreement, KYB/KYC, MSB/payment-services legal review, corridor entitlement, business ownership and terms acceptance required. |
| Funding | Funding event payload example includes USDC via Solana SPL, with \`fid\`, \`tx_hash\`, \`network\`, \`asset\`, and \`status\`. | No verified Senda account/deposit address or allowable Solana mint; wallet signs ONLY user-approved on-chain transfer to authenticated provider-issued instruction. Do not treat a webhook as proof of receipt. |
| FX quote | Business FXaaS describes quote -> trade -> MXN balance. | Enterprise quote route/fields/TTL/limits, pricing and credentials need account-specific verification. The published \`international-transfers/v1/quotes\` example targets ARS, **not a confirmed MXN FXaaS contract**. |
| FX execution | Business FXaaS advertises stablecoin-to-MXN conversion. Standard Trading API has order operations but separate permissions. | No connected conversion or production settlement account. Lock quote and require explicit customer approval/authorized partner workflow. |
| SPEI payout create | \`POST https://api.bitso.com/v3/withdrawals\`, \`currency=mxn\`, \`protocol=clabe\`; \`origin_id\` is the idempotency key. | Disabled. Confirm taxonomies/beneficiary ownership, CLABE checksum, bank validation, cutoffs, limits and contract first. Accepted is NOT settled. |
| SPEI payout lookup | \`GET /v3/withdrawals\` and \`GET /spei/v2/withdrawals/{wid}\`; statuses include pending/processing/complete/failed; failed payments can have refund records. | No authenticated Senda access. Before any settlement claim, query authenticated provider state, match beneficiary & amount, reconcile ledger and refunds. |
| Webhooks | New Webhooks API with HTTPS per-event subscriptions; funding/withdrawal event payloads; events can be duplicated or out of order. Legacy \`POST /api/v3/webhooks\` subscription is deprecated. | No callback enabled. Require Bitso's active transport authentication/signature method, event storage + replay protection + idempotent processing, then independent API reconciliation. |
| Reconciliation | Withdrawal IDs, funding IDs, status and SPEI details support correlation. | Need durable intent ID, Solana tx, funding ID, FX order, payout \`wid\`, \`origin_id\`, fees, beneficiary fingerprint, provider verified finality and refund account. |

Primary documentation:
- https://business.bitso.com/en/fx-as-a-service
- https://docs.bitso.com/bitso-payouts-funding/docs/how-to-enable-international-payments-in-mxn
- https://docs.bitso.com/bitso-payouts-funding/reference/createwithdrawal
- https://docs.bitso.com/bitso-payouts-funding/reference/listwithdrawals
- https://docs.bitso.com/bitso-payouts-funding/docs/list-your-withdrawals
- https://docs.bitso.com/bitso-payouts-funding/docs/webhooks
- https://docs.bitso.com/bitso-payouts-funding/docs/managing-webhook-subscriptions
- https://docs.bitso.com/bitso-api/docs/create-signed-requests
- https://docs.bitso.com/bitso-api/docs/get-account-balance
- https://docs.bitso.com/bitso-payouts-funding/docs/request-an-international-transfer-quote

## Implemented in this branch

- \`services/bitso-business/bitso-balance.mjs\` implements **server-side, read-only** HMAC authentication to \`GET /api/v3/balance/\` using the documented *Trading API* protocol. It has a fixed host allowlist, fixed route, GET-only transport, injected monotonic nonce allocator, no payout privileges and no browser integration.
- \`services/bitso-business/mexico-state.mjs\` implements explicit consent, quote-expiry and fail-closed payout state contracts. Its evidence object is a **logical prerequisite**, not a cryptographic verifier or authenticated provider integration.
- \`scripts/bitso-business.test.mjs\` exercises signed request construction, mock HTTP responses, negative authorization paths and settlement gating.
- No Bitso Business authenticated API, FX order, webhook receiver, live quote or payout executor is active. Neither the source code nor tests can move funds. This is a reviewable integration foundation, **not live rail activation**.

## Non-custodial distinction

Senda can remain a wallet-native interface and avoid holding user private keys. However, once the user explicitly sends USDC into a Bitso-controlled deposit address, Bitso or a licensed counterparty has custody/control of the deposited assets while converting/settling. Calling the entire end-to-end transaction non-custodial would be misleading.

A wallet signature approves exactly the blockchain transfer being signed. It does **not** by itself provide consent for a later discretionary FX trade or unrelated bank payout. Senda must capture an explicit, auditable transaction consent (quote, fees, recipient fingerprint, network/mint, expiration, refund terms), or use a legally approved standing instruction with narrowly limited powers. Agents may propose only; never silently sign or submit payouts.

## Production activation checklist (all blocked until verified)

1. Bitso Business contract and account verification for the sending and receiving jurisdictions; licensed-entity-of-record, money transmission/AML/sanctions obligations and third-party payout permissions decided in writing.
2. MXN activated for non-Mexican institutional account (web UI), confirmed Level 1+, corridor limits, settlement schedule and permitted transaction purpose. Confirm SPEI beneficiary and refund responsibilities.
3. Account-scoped staging and production credentials, 2FA/IP policy, durable nonce allocator, secret rotation and independent read vs write privileges. Never commit secrets.
4. Obtain exact **FXaaS Mexico API contract**: version, quote/execution routes and fields, TTL, spreads/fees, supported source stablecoins/token networks, deposit instructions and production payout entitlement.
5. Integration tests in permitted Bitso stage: funding on approved network, stablecoin credit, fresh executable FX quote, explicit user approval, idempotent payout submission, authenticated status lookup, webhook duplicate/replay/out-of-order handling and reconciliation.
6. A small real authorized transfer under documented limits, real FX execution, a real SPEI deposit receipt and matching end-to-end ledger entries before \`live-settlement-verified\`. Verify failed/returned payout recovery.
7. Production feature flag remains off until business/compliance/operations sign-off. Retain \`candidate\` in \`src/lib/liquify-global.mjs\`. Do not advertise MXN bank payouts or present a transfer success without authenticated final settlement.

## Validation commands

\`\`\`bash
node --test scripts/bitso-business.test.mjs scripts/bitso-withdrawals.test.mjs scripts/liquify-global.test.mjs
npm run typecheck
npm run build:dev
\`\`\`

Unit tests use fakes, not Bitso credentials; no authenticated provider or SPEI execution test has been performed.


## Complementary technology implementation — 2026-11-26

New server-only components:
- `services/bitso-business/webhook-signatures.mjs`: pinned official public-key retrieval at `https://api.bitso.com/v4/webhooks/public-key`, signed `payload` verification using RSA-SHA256 PKCS#1 v1.5, public-key rotation/cache, strict body/header checks, resource-to-event binding, and PII-minimized output. **No direct bank settlement from a webhook.** Documentation: https://docs.bitso.com/bitso-payouts-funding/docs/webhook-event-signatures
- `services/bitso-business/webhook-inbox.mjs`: transactionally committed unique event receipt and durable reconciliation-job interface, using a caller-provided transactional store; deliberately *not* a public HTTP handler. Database implementation must enforce unique primary-key, transaction rollback and durable outbox. No in-memory dedupe for production.
- `scripts/bitso-webhooks.test.mjs`: real RSA keypair unit tests for signature validation and tamper rejection; state/deduplication tests use a fake transactional database for development only.

**Webhook API nuance:** `funding` and `withdrawal` correspond to Bitso Fundings/Withdrawals API. The newer Unified Payments API uses `payin` / `payout` with different resources, and MUST get a distinct validated adapter after the account's API product is chosen. Do not route those events into this legacy-specific parser. See https://docs.bitso.com/bitso-payouts-funding/docs/webhook-event-payloads

**Open production tasks (not shipped):**
1. Deploy durable PostgreSQL inbox/outbox keyed by provider account + resource + event state and hash, plus transactional job dispatch to a private worker; configure private connection pooling, row-level account isolation, dead-letter queue and audit retention.
2. Authenticated read-only provider status queries (with account-specific schema) and independent beneficiary/bank settlement evidence; compare exact integer minor units rather than formatted strings in production. No automatic retry of unknown-status payout submissions.
3. Provider-signed delivery endpoint with raw-body capture, strict content length, configured source-IP allowlist (only behind a trusted reverse proxy), rate limiting, preconfigured provider account binding, and secure 2xx response **only after durable receipt**.
4. Provider account + KYB + FXaaS enterprise contract + compliance and data privacy approvals, exact source-token network and approved deposit instructions, quote/FX entitlement, SPEI payout authorization and refund/chargeback policy.
5. Integrate approved FX quote into Senda's explicit wallet intent authorization and external payout mandate; preserve the user's signer and never assume a Solana signature authorizes unrelated conversions.
6. Full CI build, staging contract tests, reconciliation drills, and actual low-value SPEI receipt before route activation. The new modules **cannot** enable bank payouts.

Run focused tests:
```bash
node --test scripts/bitso-business.test.mjs scripts/bitso-withdrawals.test.mjs scripts/bitso-webhooks.test.mjs scripts/liquify-global.test.mjs
```
