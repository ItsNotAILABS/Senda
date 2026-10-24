# Senda transaction recovery — wallet-scoped, browser-local

This lane is **recovery and visibility**, not a settlement ledger or a delegated execution system. It is integrated into current-main Jupiter swaps and USDC/SOL sends. It does not execute an additional transaction or retry a broadcast automatically.

## State machine

- **Pending:** a wallet/RPC signature was returned and recorded immediately after broadcast. The chain may not have processed it. The same wallet, input asset, destination and raw amount is blocked from another signing attempt until a verified chain outcome is known.
- **Confirmed:** Solana explicitly returned `err: null` and `confirmationStatus: confirmed`. It is not finality.
- **Finalized:** Solana explicitly returned `err: null` and `confirmationStatus: finalized`.
- **Failed:** Solana returned an explicit non-null execution error. An RPC outage or missing status NEVER becomes failure or success.

A one-time post-broadcast confirmation check can time out after a transfer eventually succeeds. The journal remains pending, without a successful payment or trade receipt. After refresh, the **Chain receipts** expander in the shared wallet bar shows the signature and offers **Recheck on-chain**, which performs a batched read-only `getSignatureStatuses` with transaction history enabled. Explorer links expose the actual signature.

## Boundaries

- Only public wallet addresses, mints, amounts, signatures and status are stored. There are no private keys or wallet session tokens in this journal.
- The browser's `localStorage` can be erased, edited, corrupted, or out of sync across devices. Duplicate blocking and counters in a browser are **not authoritative** financial controls. Multi-tab updates are not transactional. Stronger guarantees require an authenticated server-side idempotency key and durable settlement ledger plus chain reconciliation.
- If storage is unavailable/corrupt, the signing path fails closed **before requesting a signature**. After broadcast, a storage failure includes the signature and refuses to claim success.
- A never-resolved pending transaction remains blocked; no 24-hour automatic release. An expired or missing chain signature needs deliberate verification with transaction history/last-valid-block-height before an operator should release it.
- Only the newest 80 local receipts are retained, and unresolved entries take precedence over finalized/failed history. If the journal fills with unresolved submissions, new sends fail closed.
- The confirmation journal does **not** currently backfill the app's separate position and account accounting for transactions that settled after a timeout. The amounts displayed for SOL sends are quoted through the current Jupiter quote lane for wallet-cap checks; this quote is not an independent oracle.

## Tests and production gates

Targeted local tests:

```sh
node --test scripts/tx-journal.test.mjs scripts/tracked-confirmation.test.mjs
```

These cover recovery after re-read, owner isolation, duplicate suppression, terminal failures, RPC outages, delayed confirmation, malformed journal contents, and retention.

Before promotion to production: full typecheck and build, injected Phantom/Solflare tests, mobile wallet return-path tests, concurrent-browser idempotency tests, backend ledger, independent chain/finality reconciliation, and end-to-end transfer authorization review. No wallet transaction or deployment was performed here.


## Concurrent wallet execution

Jupiter signing and USDC/SOL sends are wrapped in `withWalletExecutionLock`. For a given public wallet address:
- An in-memory lock rejects overlapping signing attempts in the **same tab**, including attempts made while a previous wallet prompt is unresolved.
- If supported by the browser, `navigator.locks.request(..., { ifAvailable: true })` also refuses simultaneous requests from other tabs of the same origin. The entire quote/signature/confirmation flow stays inside the lock, so duplicate checking is repeated after access is granted.
- Locks are released on success and exceptions. A released execution lock does **not** erase a pending journal record after a confirmation timeout. The duplicate guard remains active until a verified chain result.
- Browser Web Locks are not a server-authorized session key. Older browsers may only get the same-tab fallback; completely separate devices/origins remain independent. Authoritative cross-device concurrency control still requires a durable authenticated backend.

Targeted lock tests: `node --test scripts/wallet-execution-lock.test.mjs`. All **15** new journal, confirmation-wrapper, and execution-lock tests passed locally.
