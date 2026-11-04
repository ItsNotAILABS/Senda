# Senda on-chain agent product / track criteria

Current deliverable: **wallet-signed natural-language payment draft and confirmation UI** at `/pay/intent`. This is not a deploy receipt. Exact transfer calls reuse existing `payUsdc` and `paySol` signing and confirmation, rather than a new payment engine. The strict parser supports numeric USDC/SOL transfers to base58 Solana wallet addresses. Swap requests become **unexecutable drafts** pending balance-aware quote/simulation and explicit confirmation; no unreviewed swap is permitted. No AI-generated instruction can authorize a signature.

## Capability truth table

| Track concept | Current state |
|---|---|
| Solana Pay / SPL transfers | Existing wallet-signed transfer implementation; new plain-language review route |
| Natural-language transfers | Constrained deterministic parse + human review |
| Natural-language swap | Draft-only (needs exact mint, balance, Jupiter quote, simulation, wallet signing) |
| Perps | Existing Senda Jupiter and other venue-specific flows; not modified |
| Autonomous spending with hard on-chain caps | Not shipped; PARRALAX budget decisions are off-chain and not escrow |
| Machine USDC payments | Direct wallet-signed payment can be composed; metered API settlement not yet shipped |
| Security analyzer | Existing transaction/quote guards; no comprehensive malicious-program classifier |
| Verifiable model provenance | Not shipped; output-hash registry and independent reproducibility proof still needed |
| Lending / RWA | Not shipped as safe funded production contracts |

## Production checks
- Run `node --test scripts/solana-intent.test.mjs`, `npm run typecheck`, `npm test` and `npm run build:dev`.
- Exercise actual connected wallets on Solana devnet with mock USDC addresses isolated from mainnet; existing payment code targets mainnet and **must never be tested with devnet addresses in production configuration**.
- Revalidate addresses, fee payer and entire serialized transaction in wallet. Restrict supported destinations to verified allowlists for organism-funded payments.
- For automated agents, deploy independently audited per-agent PDA/SPL vaults with on-chain per-action and cumulative caps, revocation, expiry, nonce guards, and receipt ledger before claiming autonomous wallet spending.
- Do not claim Solana program deployment, bank rails, or real on-chain AI evidence without confirmed transaction signatures and independent explorer verification.
