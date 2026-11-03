# Wallet execution guard carry-forward — 2026-11-02

Status: **PARTIAL**. This branch adds tested-in-source helper modules and test files, **not** a replacement transaction signer.

The current Senda wallet-signing, Jupiter swap flow and payment UI remain unchanged. These helpers are intentionally not wired into production until the newer Jupiter API contract and existing wallet functionality are reconciled and independently tested. The old draft PR #3 cannot be merged wholesale: it replaces API hosts and signing paths with assumptions that may not match current authentication/venue behavior.

## Modules
- `quote-guard.mjs`: validates intended mints, exact raw input, slippage, bounds, quote route, and price impact.
- `confirmation-gate.mjs`: distinguishes a submitted signature from a confirmed transaction. Timeout is **unknown**, never success.
- `payment-confirmation.mjs`: wraps `getSignatureStatuses` with the confirmation gate.

## Activation checklist
1. Verify Jupiter current API origin, authentication, request/response contracts and taker wallet binding. Do not blindly replace a legacy host with a new one.
2. Confirm exact quote is the one used to construct the wallet transaction; check mint identity, minimum receive and simulation.
3. Add the confirmation gate to all payment routes without falsely retrying unknown-status broadcasts.
4. Run `node --test scripts/confirmation-gate.test.mjs scripts/payment-confirmation.test.mjs scripts/quote-guard.test.mjs`, `npm run typecheck` and `npm run build:dev`.
5. Add adversarial wallet adapter, replay, confirmation, and stale-quote tests before enabling production execution.

GitHub-hosted CI checks are currently not reliable evidence: observed runs fail before runner assignment, with zero executed job steps. These tests have not been executed in this session.
