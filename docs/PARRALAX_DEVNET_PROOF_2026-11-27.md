# PARRALAX - Solana Devnet deployment proof gate

**Status 2026-11-27: NOT DEPLOYED / NOT VERIFIED FOR AGENT EXECUTION.**

Canonical PARRALAX source at `ItsNotAILABS/PARRALAX-AIHFTFUND/solana` contains an Anchor treasury program with owner/agent/guardian roles, exact SPL limits, replay-protected nonce, owner withdrawals, pause/revoke functions and localnet tests. It currently declares the **LOCALNET-only** program ID `5HJCtwtWWvDDQiMLVuvrwyqaVfXgX3hZnzMTarTKv61p`; that key must never be treated as a managed devnet or mainnet deployment.

A direct public Solana Devnet JSON-RPC query on 2026-11-27 returned genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` and a `null` account for that localnet ID at finalized slot 526818848. This observation is not a claim about every possible separate program ID; the managed devnet program ID has not been provided.

## New verifier

`node scripts/verify-parralax-devnet.mjs` requires public release configuration (no secret keys):

- `PARRALAX_DEVNET_PROGRAM_ID`: a separately managed program public key, **not** the localnet ID;
- `PARRALAX_DEVNET_UPGRADE_AUTHORITY`: expected actual upgrade-control multisig public key;
- `PARRALAX_DEVNET_PROGRAMDATA_SHA256`: hash of the complete **raw on-chain ProgramData binary account tail**, not an attestation that source builds reproduce the ELF.

The verifier binds to Solana Devnet's pinned genesis, reads a finalized upgradeable Program and its ProgramData account, ensures the pointer is unchanged across a same-slot snapshot, checks executable loader ownership, compares upgrade authority and raw ProgramData hash, and produces a signed-off **observational JSON proof** without signing.

- A missing program exits nonzero with `not-deployed` evidence.
- Wrong genesis, owner, authority, hash, binary layout or stale context fail closed.
- Even a matching program returns `releaseReady:false`, `sourceBuildVerified:false`, `securityAuditVerified:false`, `agentExecution:disabled`. This is only a chain identity and binary-account proof, **not** authorization to spend.
- Tests: `node --test scripts/parralax-devnet-proof.test.mjs` (5/5 focused tests passed).

## Separate deployment requirements

1. Complete PARRALAX full Rust/Cargo/Anchor program tests and source audit.
2. Generate and safely manage a **new devnet program keypair** without committing it; replace the localnet declare_id in a reviewed deployment commit and pin the new ID in Anchor configuration.
3. Build and verify a reproducible SBF artifact; do not infer source equality from the raw ProgramData hash alone.
4. Deploy using an approved authenticated signer under a controlled release. Capture confirmed deployment signature, slot, executable Program/ProgramData accounts and upgrade authority.
5. Transfer upgrade authority to reviewed multisig control; verify the on-chain account again afterward.
6. Create an owner-signed devnet treasury and tagged SPL test mint, fund it with test tokens, test agent spend, replay rejection, recipient mismatch, limit violations, guardian pause/revoke, owner recovery, and finalized before/after token balances. Retain explorer-verifiable receipts.
7. Only then connect Senda's agent treasury read feature under server-side pinned network/program/genesis. Agent execution remains disabled until independent program security review and permissions testing.

**Never upload secret keys to ChatGPT or commit them to GitHub.** Nothing in this change performs a deployment or makes a payment.
