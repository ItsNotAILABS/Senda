# Senda Treasury / PARRALAX Solana integration

This package defines **review-only client-side intent artifacts**, exact SPL minor-unit conversion, machine-payment verification drafts and verifiable-AI hash commitments. It never signs a transaction or reports that a hash was anchored on chain.

Related program source: `ItsNotAILABS/PARRALAX-AIHFTFUND/programs/agent-treasury`.

The treasury contract is not deployed. Never accept a program id from an organism or application query; pin the verified on-chain program id from a signed configuration manifest. To actually integrate it, generate an Anchor IDL from compiled program, derive and independently verify PDAs/ATAs, connect mainnet/devnet separately, simulate wallet-signed initialize/deposit and agent-signed spends, and independently confirm finality and exact SPL token movements. Program key management belongs to secure service infrastructure, not the model or React localStorage.

## On-chain agent spend lifecycle

Owner signs initialization -> owner signs funding transfer -> PARRALAX verifies vault state -> organism proposes service request -> PARRALAX checks policy and service allowlist -> isolated agent signer signs a specific SPL spend -> program checks nonce/caps/recipient -> validator confirms transfer -> PARRALAX verifies receipt and service delivery -> Senda presents verifiable history.

**This implementation has not completed that lifecycle.** It includes the program source, Senda request validation and receipts/commitments only; no deployed program, agent remote signer, durable budget reservation, paid inference API, custody onboarding or production compliance.

## Product expansion contract

- Natural-language payments: existing Senda PR #35 and wallet-signed SOL/USDC payment functions, awaiting merge.
- Perps: existing venue-specific Senda code, separate PARRALAX risk + exit-planning PR.
- Security: classify risk based on independently verified program/quote/account information, never unsupported confidence scores.
- Agent-controlled wallets: require verified owner authorization and bounded on-chain vault as primary guard.
- Micropayments: use exact amount and fee-aware Solana SPL settlement; return a service result only after confirmed payment, checked against recipient and token mint.
- Provenance: digest only is not proof until anchor signature and model/data evidence are independently reproducible.
- Lending/borrow, issuer-backed RWA, bank deposits and payment cards require connected audited protocols and regulated partner obligations. No financial claims without receipts.
