# Bitso Mexico - Senda operations and exact wiring map
**Status:** REVIEW / NOT CONNECTED. Neither this work nor the proposed launch permits live SPEI or FX transactions.

## What is actually wired in PR #50
| Source → destination | Contract | Shipped status |
| --- | --- | --- |
| Bitso → /api/bitso-webhook | raw JSON HTTP, RSA-SHA256 payload signature, fixed Bitso key source | **Route in source**, disabled by default |
| /api/bitso-webhook → PostgreSQL | atomic insert into webhook inbox + reconciliation outbox | **Implemented**, requires DATABASE_URL and database migration |
| Deployment → migrations/0009_bitso_inbox.sql | canonical Senda /migrations glob + scripts/migrate.mjs | **Migration added**, NOT applied to deployed DB |
| Scheduled private worker → outbox | leased SKIP LOCKED rows, attempt fencing and dead-letter | **Implemented**, no scheduled deployment |
| Worker → Senda approved intent | map account + wid to approved origin_id | **Read-only lookup**, no authorization API or approval writer |
| Worker → Bitso withdrawals | HMAC request using DB-allocated nonce | **GET-only client**, account credentials missing |
| Worker → provider observation ledger | immutable status observation with no payout receipt claim | **Implemented**, database not deployed |
| Senda wallet signing → provider deposit | signed Solana USDC transfer to provider-issued address | **NOT WIRED**: provider deposit address and approved corridor missing |
| Provider quote/FX → SPEI bank payout | approved enterprise APIs + idempotency + mandated consent | **NOT WIRED**: no enterprise contract or production scopes |
| Payout success → user receipt | confirmed provider state plus independent bank proof | **NOT WIRED**: do not show settlement success |

## Server configuration (set only in private deployment)
- \`DATABASE_URL\`: persistent PostgreSQL/Neon connection; essential. A memory-only PGLite database is intentionally rejected by webhook intake.
- \`SENDA_BITSO_WEBHOOK_ENABLED=true\`: enables only webhook acceptance, **not payments**.
- \`SENDA_BITSO_PROVIDER_ACCOUNT_ID\`: approved Bitso account identifier from private configuration, not a client-supplied account ID.
- \`SENDA_BITSO_RECONCILIATION_ENABLED=true\`: enables only read-only reconciliation.
- \`BITSO_READ_API_ENV=stage\` or \`production\`: explicit API host selection.
- \`BITSO_READ_API_KEY\`, \`BITSO_READ_API_SECRET\`: read-only credentials stored in the managed secrets service; NEVER client-visible or committed.

Ensure no same-key nonce allocator runs outside the shared DB: \`createBitsoNonceAllocator\` increments atomically. Minimize credential privileges. Rotate keys and record audit events without logging Authorization headers.

## Deployment sequence
1. Pass tests and full app typecheck/build; latest GitHub CI reports failure, so the PR cannot be called production-ready.
2. Apply \`migrations/0009_bitso_inbox.sql\` using \`npm run db:migrate\` on a private PostgreSQL database after backup; verify schema, indexes and privileges. **Do not run money movement in preview.**
3. Configure dedicated DB runtime role for inbox/outbox and a separate read-only Bitso key. Set \`SENDA_BITSO_WEBHOOK_ENABLED=true\` only after provider account and correct subscription setup.
4. Set a private ingress/WAF rule for the endpoint with request/body size, per-source rate limits, TLS, protection against path probing; store only minimal received event metadata.
5. Subscribe the correct **funding/withdrawal** events for the Withdrawals API (not Unified Payments \`payout\`/ \`payin\` events). Verify signatures and retry conditions against actual Bitso sandbox payloads.
6. Provision scheduled isolated worker to invoke \`node services/bitso-business/run-reconciliation.mjs\` with private credentials, limited execution time, alerting and dead-letter monitoring. Worker is read-only.
7. Before any payout submission is later implemented, build provider-verified funding instructions, authenticated quote TTL, signed wallet transfer binding, independent FX mandate, beneficiary checks, idempotent provider execution, and final receipt reconciliation.

## Operational safety
- HTTP 202 means an authentic event was durably queued, **not paid**.
- HTTP 401 means signature was rejected. HTTP 503 means the integration is disabled or durable persistence failed; Bitso should retry according to its documented retry schedule.
- Worker observes authenticated provider statuses only; it cannot fabricate beneficiary bank settlement. It defers missing intent mappings and unsupported funding events.
- Run reconciliation with restricted DB access. The outbox stores no private keys, CLABE or full beneficiary PII.
- Alert on: webhook 503, key fetch errors, dead-letter count, oldest pending job age, lease expiry rate, provider 429/5xx, missing origin mappings, deposit credit mismatches, and settlement delay.
- Document explicit retention/deletion rules, least-privilege database roles, and financial audit export before production onboarding.
- Under a high-severity mismatch: freeze new deposit instructions, avoid automatic payout retries, quarantine affected intents and notify the operator. Never turn an unverified receipt into a success.

## Required remaining external approvals
Bitso Business contract, KYB, MXN corridor and SPEI permissions, account-specific enterprise FXaaS API spec, supported Solana native USDC mint/network, deposit address mapping, legal entity responsibility, AML/sanctions screening, beneficiary handling and a verified low-value end-to-end bank settlement.

API source documentation:
https://docs.bitso.com/bitso-payouts-funding/docs/webhook-event-signatures
https://docs.bitso.com/bitso-payouts-funding/docs/webhook-event-payloads
https://docs.bitso.com/bitso-payouts-funding/reference/createwithdrawal
https://business.bitso.com/en/fx-as-a-service
