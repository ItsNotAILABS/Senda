# Senda + PARRALAX — Financial Security, Encryption & Agent Trading

**November 25, 2026 | Engineering security architecture | Not an external audit**

## Intended promise

**Encrypted financial context. Verifiable decision receipts. Bounded agent authority. Wallet-native settlement.**

Senda is a BYOW financial frontend. PARRALAX is an independent financial intelligence/risk/budget service. Solana wallet signatures and correctly deployed policy programs control actual funds. Senda does not become a bank, licensed custodian, guaranteed anti-rug service or certified zero-knowledge system merely by adding cryptography.

### Existing cryptography — what it really protects

| Surface | Existing code | Mechanism | Main boundary |
| --- | --- | --- | --- |
| Private user data | src/lib/private-box.ts | PBKDF2-SHA256, 250,000 iterations, random 128-bit salt, AES-256-GCM random IV | At rest only. Weak eight-character passwords can still be guessed offline. |
| Wallet-linked encrypted records | src/lib/seal.ts, docs/wallet-security.md | Wallet-derived AES-GCM, revision-aware encrypted continuity, authenticated wallet grant | Unlocked browser JS can access plaintext; wallet signing is not the same as hardware-backed secret isolation. |
| Phone identity/passport | src/lib/passport.ts | PRF/passphrase-unwrapped master key and local signed grants | Device compromise or stolen unlock context remains relevant. |
| Login | src/lib/auth/server.ts | Better Auth session and OAuth token encryption | Depends on deployer secrets, database encryption, cookie/origin policies and session integrity. |
| Server audit evidence (new, not wired) | integrations/parralax-security/envelope.mjs | AES-256-GCM, unique 96-bit nonce, HKDF-SHA256 key separation, authenticated tenant/record/type/revision context, KMS key version | Must receive a KMS/HSM-managed 256-bit secret; does not itself provision, rotate or protect master keys. |
| Legacy agent-funded wallets | src/lib/agent-live.ts, src/lib/table-pot.ts | Existing raw private keys may be stored in browser localStorage | **HIGH RISK:** do not fund new unattended agents on this pattern. Keep recovery available; migrate deliberately with verifiable balances and user authorization. |

**Not supported by the code as a blanket statement:** zero knowledge, confidential computing/enclave attestation, post-quantum encryption, FIPS certification, non-custodial agent keys in an HSM, bank deposit insurance, or general transaction safety.

## New evidence envelope contract

- Server-only AES-256-GCM with a fresh 96-bit nonce for every write.
- HKDF-SHA256 per record/tenant/type/revision/key ID; record identity is authenticated as AEAD AAD.
- Ciphertext cannot be transplanted to another tenant, receipt, schema type or revision without failed authentication.
- Only the key ID and record metadata are exposed outside ciphertext; server can still see tenant/record identity, size and access patterns.
- Fail closed on unknown key IDs, bad tags, unknown tenant, invalid context and malformed envelope sizes.
- Never put KMS key bytes in React/Vite environment variables, agent prompts, logs or database records.
- Stored ciphertext does **not** prevent malicious JS, a compromised server process, or a privileged KMS operator from accessing an unlocked plaintext record.

Deploy with managed KMS/HSM key versions, key access policy, credential rotation, envelope rewrap jobs, encrypted backup, retention, incident response and access-log audit. Existing encrypted local data is not silently migrated or deleted by this additive module.

## Agent trading — phased authority

1. **Observe** — use authenticated live prices, order books, funding, volatility and market-data QA; no wallet key.
2. **Evaluate** — measure spread, impact, oracle freshness, liquidity, transaction costs, correlation, portfolio drawdown and venue outages.
3. **Propose** — produce a quote-linked trade intent and deterministic PARRALAX risk result.
4. **Paper and shadow** — record hypothetical trades and missed fills with fees, funding, slippage and out-of-sample attribution. No simulated fills presented as executable liquidity.
5. **Owner-authorized limited execution** — separately deployed and audited program-enforced vault, atomic budget reservation, private key isolation, strict venue allowlist, transaction simulation, and rollback/finality reconciliation.
6. **Scale** — only after positive net-of-costs out-of-sample results, reproducible risk and fill-quality evidence, compliance review and kill-switch tests.

Risk limits are set by owner/governance, **never by an agent prompt**. PARRALAX risk decisions are not themselves wallet signatures.

Eight bounded research roles are defined under PARRALAX services/agent-trading; none can sign, submit or transfer. An operator-authenticated PARRALAX server must supply trusted risk limits, quote evidence, portfolio state and oracle data. Caller-provided `trusted: true` assertions are not proof. Senda's server-only client strips agent-submitted portfolio policy/evidence fields.

### Professional measurement

Log decision-time quote, venue order book, execution venue, partial-fill ratio, implementation shortfall (basis points), fees, funding, bid-ask spread, markout and adverse selection, portfolio P&L, exposure and leverage, order rejection, venue/RPC error rates, and net out-of-sample return against transparent benchmarks. Do not cherry-pick filled orders or misstate quote availability as realized profit.

## Explicit high-priority remediation

- Replace raw localStorage browser keys in agent-live and table-pot with a documented, user-approved recovery/migration path and audited isolated signing. Do not erase legacy keys before funds are recovered.
- Treat an unlocked browser as untrusted for key custody; CSP, dependency integrity and XSS testing are mandatory but insufficient for long-lived agent signing.
- Require tenant-bound service authentication and **durable** PARRALAX policies, reservations, replay tables and audit history before execution.
- Implement secure close/reduce-only behavior during a risk incident; a paused venue may make an exit impossible.
- Add signed, reproducible deployment receipts and separate mainnet/devnet addresses. Never route through a paused or unverifiable venue.
- Verify all third-party SDK licenses and the exact version before dependency installation or vendoring.

## Release tests

- `node --test integrations/parralax-security/envelope.test.mjs`
- `node --test integrations/parralax-trading/client.test.mjs`
- PARRALAX: `node --test services/agent-trading/pretrade.test.mjs`
- Run Senda typecheck, unit tests, static analysis, wallet integration tests, RPC isolation, and fault injection before merges.
- No passing CI, real trades, confidential-compute attestation, successful HSM integration or external audit claimed by this document.

## Product wording suitable for Senda

> Senda keeps the wallet in the user's control and gives trading agents constrained, reviewable responsibilities. Sensitive financial records can be encrypted with authenticated, versioned protection. PARRALAX evaluates portfolio and execution risk before the wallet or a separately authorized treasury program moves funds. Every on-chain action still requires independent confirmation and reconciliation.

Avoid: "guaranteed safe," "can't be rugged," "all data encrypted end-to-end," "autonomous institutional trading live" or "bank-grade certified."
