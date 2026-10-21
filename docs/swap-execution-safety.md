# Jupiter swap execution and endpoint migration

Senda now uses `https://api.jup.ag` for Jupiter quote, swap, price, and token requests, rather than the old Lite hostname scheduled to stop serving traffic on **October 30, 2026**. Duplicate fallback calls to the same gateway have been removed.

## Safety in the wallet-signed swap path

- A raw Jupiter **ExactIn** quote must preserve input mint, output mint, input amount, 100 bps slippage and executable route.
- Quoted token amounts and the minimum receive must be positive and fit within Solana u64. An invalid impact or price impact above 5% is rejected before any wallet prompt.
- For six-decimal input stables (USDC, USDT, CASH and PYUSD), the actual raw amount must be at or below the wallet's configured dollar-denominated cap, even if caller display estimates are lower.
- The *same checked quote object* is submitted to the Jupiter swap builder. Senda does not request the deprecated dynamic slippage override.
- The returned transaction must identify the connected Solana wallet as the fee payer. The wallet still simulates and requires explicit user signature.
- Tests: `node --test scripts/quote-guard.test.mjs scripts/jupiter-host.test.mjs`.

## Operations and remaining production gates

Keyless access to Jupiter's gateway is available but severely rate-limited per IP. Client-side publishable keys do not raise that limit. Sustained production usage requires a bounded backend quote/price proxy with a **server-side** API key, caching and throttling; never embed a server key in browser code. Watch for HTTP 429 responses.

Jupiter's Metis Swap v1 endpoints are no longer the recommended integration. Migrating to Swap v2 requires understanding its order and execution contracts and separate wallet/failure tests; it must **not** be done by blindly rewriting URL paths.

The fee-payer check and quote guard are not a complete disassembly or audit of all swap instructions. A transaction signature is a submission acknowledgment, not confirmation of settlement. Verify the on-chain result before presenting an irreversible fill. No live wallet transaction, KYC/financial approval or deployment was performed during this patch.

## Confirmation-sensitive fill records

The client now checks `getSignatureStatuses` on the submitted signature before writing a trade to the local fill ledger. Only a status of `confirmed` or `finalized` accompanied by an explicit `err: null` is treated as successful. A transaction with an on-chain error is rejected; missing status, malformed status and temporary RPC errors never become fills.

After the bounded confirmation window, Senda leaves the fill unrecorded, writes an awaiting-confirmation activity note and shows the signature so the user can verify it before another attempt. This is **not** automatic reconciliation: an eventually confirmed transaction needs a separate reconciliation flow to appear in the local fills. A confirmed transaction can still be subject to a rare chain reorganization until finality. The server-side move record is a submission receipt, not a settlement certificate.

Run `node --test scripts/confirmation-gate.test.mjs scripts/quote-guard.test.mjs scripts/jupiter-host.test.mjs` for the targeted checks.
