# Senda release certification register — 2026-11-26

## Current outcome: PARTIAL / NOT PRODUCTION CERTIFIED

Canonical repository: ItsNotAILABS/Senda. Baseline before this integration: `8fa9aacf91db799808bd78778b2b2f0cf3e7592b`.

### Implemented in the current integration branch
- Added independent, read-only Solana mint inspector and Jupiter V2 route preview without replacing the existing Jupiter V1 signing flow.
- Added Kalshi history, contract-detail, source-classified markets, and independent contingency scenario calculation modules. Retains the pre-existing event desk and does not impersonate an eligible Kalshi or DFlow order.
- Added `/invest/safety` as an optional research surface and one menu route. No changes to current trade ticket, wallet state, payment signer, app shell, or global styling.
- Preserved test modules from original Senda branches #45 and #46.

### Already on Senda main (as inspected)
- Real Phantom wallet-signed USDC sends with exact-cent `TransferChecked`, recovery journal before broadcast, post-reload uncertain-send lock and recovery display (PR #48/#49).
- Settlement webhook raw-body verification with per-intent database CAS and fail-closed 503 when funding provider credentials absent; no external fiat funding processor connected.
- PARRALAX layout-v2 treasury instruction client. Neither that client nor a risk decision establishes on-chain deployment.

### PARRALAX changes merged
- `PARRALAX-AIHFTFUND` #16: separate non-executing financial risk API.
- `PARRALAX-AIHFTFUND` #17: Anchor Solana treasury source with localnet-reported test record. Release manifest explicitly has `devnetDeployed=false` and `audited=false`. Production keypair/authority, verified build, devnet receipts, audits and signer isolation remain blocked.

### Verification requirements
1. Restore GitHub Actions execution: latest observed Senda jobs have `runner_id=0`, zero steps, failed. This is account/runner administration, not a pass/fail of app code; no code-only YAML change can force a provisioned runner.
2. `npm ci`; `node --test scripts/ecosystem-upgrade.test.mjs scripts/jupiter-endpoint-regression.test.mjs scripts/kalshi-history.test.mjs scripts/contingency-analysis.test.mjs`; `npm run typecheck`; `npm run build:dev`.
3. `node --test scripts/friend-payments.test.mjs scripts/journaled-send.test.mjs scripts/money-settlement-core.test.mjs scripts/money-webhook.test.mjs scripts/solana-pay-request.test.mjs` plus browser/mobile wallet confirmation and recovery.
4. `(cd services/liquify && go test -race ./... && go vet ./...)` and private-ingress testing with real Jupiter/Solscan credentials. `GET /healthz` alone is not market readiness.
5. Require approved external accounts and signed provider receipts before enabling bank/card funding, fiat payout, contingent insurance or live event orders.
6. Devnet treasury gate: reviewed deployed program ID and authority, reproducible SBF build, capped mint, owner/guardian, transaction signatures, confirmed SPL balance movements, nonce and pause/revoke tests, independent security review. Never use the localnet program ID on devnet/mainnet.
7. Release protection: main branch currently unprotected (as of 2026-11-25). Configure required reviews, mandatory non-skippable checks, signed commit/release discipline and audited secrets through repository administration.
8. Cloudflare deployment: a GitHub merge is not a release. Verify the configured deployed Worker, environment, migrations and production transaction receipts separately.

### Explicit status vocabulary
- CODE: reviewed repository files exist.
- TESTED LOCALLY: only when a reproducible test receipt exists.
- DEVNET: deployed to Solana devnet with verified transaction receipts.
- LIVE: user-accessible release plus verified backing provider/on-chain evidence.
- BLOCKED: safety or infrastructure gate not met.

**No production, chain deployment, external provider onboarding, key access or financial execution is claimed by this integration.**
