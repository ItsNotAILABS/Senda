# Senda wallet hardening reconciliation — 2026-11-02

Status: **CODE ALREADY IN MAIN** for existing execution safeguards; this PR adds a review record only.

Current `main` includes:
- `src/lib/quote-guard.mjs` with a **stricter** ExactIn minimum-output/slippage check than old draft PR #3.
- `src/lib/jup-sign.ts` using official Jupiter API host, `verifySwapQuote`, `verifyStableSpend`, a wallet execution lock, duplicate-submission guard, and `confirmTrackedSubmission` after broadcast.
- `src/lib/solana-pay.ts` using the tracked confirmation and execution-lock workflow for payments.
- Existing confirmation helpers and test files.

The first carry-forward of draft PR #3 would have **removed** the minimum-output constraint from `quote-guard.mjs`; the regression was detected and reverted on the integration branch before merge.

**Do not merge PR #3 wholesale**. It is stale relative to stronger current wallet code. Preserve the current app, signer, UI, transaction journal and safety checks. Do not replace them with the 2026-10-21 branch.

## Remaining verification
Run `node --test scripts/confirmation-gate.test.mjs scripts/payment-confirmation.test.mjs scripts/quote-guard.test.mjs`, `npm run typecheck`, `npm run build:dev`, and wallet adapter integration tests. Reconfirm Jupiter V2 API contracts, authentication, transaction expiry, quote consistency, and unknown-status recovery. Any payment or swap timeout is **unknown**, never a confirmed fill.

GitHub Actions jobs are currently failing before a runner is allocated (zero executed steps). No local/runtime test execution is claimed by this report.
