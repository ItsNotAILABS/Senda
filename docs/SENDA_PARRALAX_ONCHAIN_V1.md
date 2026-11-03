# Senda x PARRALAX: on-chain utility boundary (2026-11-01)

Status: PARTIAL / CODE REVIEW REQUIRED. No audited funded cover, loan, or delegated payment protocol is deployed by this change.

## Present state
- Senda Jupiter swaps stay wallet-signed.
- Existing `chain/senda-chain/src/cover.rs` encodes terms in a memo, not a payout policy.
- Existing `chain/senda-program/src/lib.rs` stores 45 bytes of terms in a Solana program account. This branch fixes overwrites, expired terms, zero amounts, and invalid System Program accounts.
- This account is **not** a USDC premium escrow, oracle-validation service, or settlement engine. Do not present it as insurance or an executable payout.

## Roadmap and trust boundaries
1. Cover registry: immutable signed (wallet, symbol) terms. Versioned PDA must be introduced for repeat policies and canonical token-mint/market identifiers instead of a 12-byte display symbol.
2. Cover escrow: separate PDA and token account; enforce verified USDC mint, SPL token owner, authorized signer, funding and payout reserves **before** allowing any funded cover. Premium alone cannot fund a larger promised payout.
3. Reference prices: verify approved signed oracle accounts, ownership, feed identity, price decimals, freshness, confidence bounds, observation timestamp and market-specific eligibility. Reject missing, stale, contradictory or manipulation-prone prices; do not treat a frontend last print as on-chain proof.
4. Settlement: single redemption, deterministic thresholds, reserve accounting, expiration/refunds, paused-market behavior and adversarial tests. No operator-only discretionary payout.
5. Agent budget: optional separately funded USDC account; beneficiary allowlist, per-transaction and cumulative caps, expiry, nonce/replay protection and wallet revocation. PARRALAX never gets a blanket wallet signing key.
6. Collateralized draw: **not in v1**; requires collateral custody and a genuinely funded lender reserve, liquidation design, usable price reference and eligibility/legal assessment. Noncustodial draw against freely transferable collateral is not enforceable.
7. Receipts: bind to confirmed signature, token mint, amount, owner and transaction status; avoid freely mintable eligibility proofs and misleading NFT claims.
8. Payments: independent escrow, exact USDC token account constraints, deadline and a provable release predicate. Memo text alone is not proof of delivery.

## Invariants
- Each market is isolated; loss/revaluation does not cross subsidize another name.
- A token that remains in a user wallet is **not locked collateral**.
- An agent can propose and operate only within explicitly approved limits; no silent escalation.
- User can always revoke *future* delegations; escrow withdrawals remain subject to already-agreed beneficiary obligations.
- No false balances, fake execution receipts or claim of mainnet readiness.

## Verification gate
Compile with `cargo test --manifest-path chain/senda-program/Cargo.toml`, then `cargo build-sbf --manifest-path chain/senda-program/Cargo.toml` where Solana SBF toolchain is installed. Add integration tests for account ownership, PDA collision, malicious system account, replay, double claim, expired/stale oracle, insufficient reserves, wrong mints and withdrawals. This branch has NOT passed those deployment gates here.
