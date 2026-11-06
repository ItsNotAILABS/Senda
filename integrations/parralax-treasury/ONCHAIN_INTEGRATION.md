# Senda PARRALAX program instruction construction

`chain-client.mjs` constructs **real Solana transaction instructions** using Senda's existing `@solana/web3.js`. It matches PARRALAX treasury PDA seeds: `treasury + owner + agent + beneficiary + mint`, and the SPL associated token vault owned by the treasury PDA.

It supports the instruction account layouts for:
- initialize(owner, agent, beneficiary, mint, caps, expiry)
- deposit(owner, source ATA, amount)
- spend(agent, beneficiary token account, amount, nonce)
- revoke(owner)
- withdraw(owner, owner token account, amount)

No new Senda custody or signing path is introduced. Return the unsigned instructions to the existing connected-wallet review path **only after**:
1. Verified program deployment (non-placeholder, executable on intended cluster, pinned upgrade authority and verified artifact hash).
2. Simulation of exact transaction and full instruction/account review.
3. Correct token mint, decimals, ATA owner and source balance checks.
4. Human approval to initialize/fund; isolated signer with owner-authorized budget for program-capped agent spends.
5. Independent confirmation of signature, exact SPL movements, and PARRALAX durable receipt reconciliation.
6. Explicit devnet/mainnet segregation and known upgrade authority; no automatic production fallback.

**Status:** instruction builder committed, not hooked into the running Senda UI. The Rust program is undeployed and uncompiled in the current environment. Node integration tests are committed but not run due unavailable repository clone/dependencies. Do not label this a completed mainnet/agent action loop.
