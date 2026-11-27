# SENDA MONEY - Wallet activity and agent account verification

Status: **PARTIAL, branch source pending full build and device QA**.
Date: 2026-11-26. Scope: incremental upgrade of /payments/activity without changing transaction signing.

## Transaction verification path

1. Identify the user-controlled Phantom/Solana wallet.
2. Request wallet and canonical USDC token-account signatures from Solana mainnet RPC.
3. Obtain exact getSignatureStatuses responses. Only explicit non-error confirmed or finalized RPC evidence permits a confirmed/finalized label.
4. Query confirmed parsed transactions to calculate **exact, raw USDC delta** by matching owner, mint, and six decimals; omit amounts when transaction metadata is absent.
5. Merge the existing browser-scoped recovery journal so submitted but not yet observed transactions remain visible, clearly labeled LOCAL and not verified settlement.
6. Page independently through wallet/ATA signature streams, deduplicating by signature and preserving cursors.
7. Reuse the existing TransactionRecovery panel. The new activity page **does not sign transactions** or initiate funds movement.

## Governed agent account status

- Read-only PARRALAX status requires explicit SENDA_AGENT_TREASURY_READ_ENABLED=true.
- Server-side verified program, pinned Solana genesis, network, treasury mint and HTTPS RPC credentials are required. No provider secret is exposed to the browser.
- Existing PARRALAX inspector validates treasury program owner, treasury/vault/mint consistency and token decimals from one RPC snapshot.
- The user can inspect a treasury seed identifier; account creation, deposits, policy updates, signing, pause and revoke are **not activated** from this UI.
- The chain program has not been independently certified deployed on devnet or mainnet. A visible agent account is not a bank account.

## Reality ledger

| Capability | Status | Evidence and limitation |
| --- | --- | --- |
| Phantom swaps and USDC sending | PARTIAL (operator-used) | Founder reports >$1,000 live use; independent receipt set not supplied here |
| Wallet history from mainnet RPC | PARTIAL | Source-backed paginated wallet + canonical USDC ATA activity; full build/live smoke tests pending |
| Confirmed/finalized receipt statuses | PARTIAL | Exact signature-status RPC, not user input or local claims |
| Historical USDC delta | PARTIAL | Parsed transaction raw balances, no inferred fees or recipient |
| Recovery history | PARTIAL | Existing local journal retained; not durable cross-device metadata |
| Agent treasury readout | PARTIAL | Verified owner/mint/program/genesis when configured; disabled by default |
| On-chain agent spending | NOT CONNECTED | No audited deployed vault or agent signer enabled |
| Bank/card/Bitso SPEI rails | NOT CONNECTED | Provider agreements and payment services not certified |

## Release and security requirements

- No secret keys in client bundles; no unverified receipt counts as settled.
- Fixed/server-configured HTTPS RPC origins, bounded history reads and request timeouts.
- Keep local pending activity visible but never unlock duplicate transfers merely because the history API is slow.
- Agent controls cannot mutate authorization until on-chain program and owner signature verification are certified.
- Add durable authenticated index, per-tenant quotas, observability and replay-resistant wallet login before describing an exhaustive cross-device history service.

Required verification on an actual checkout and CI runner:

    node --test scripts/wallet-activity-core.test.mjs
    npm run typecheck
    npm run build:dev
    npm test

Run desktop and mobile Phantom tests, Solana RPC failure tests, known confirmed/failed signatures, and explicit wallet-without-USDC-ATA tests before releasing the new activity UI. GitHub Actions has been failing with no executed steps. **Do not equate a merge or a Vercel preview with production certification.**
