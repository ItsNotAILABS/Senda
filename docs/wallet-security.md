# Wallet authorization and encrypted continuity

Apply `npm run db:migrate` before serving this revision. Configure `DATABASE_URL` for durable hosted storage; the embedded preview database resets with its process. Old grants are invalidated by migration 0007, so existing clients need to reload and unlock again.

## Authorization

A server-issued, five-minute challenge binds the wallet and action. The server verifies Ed25519 ownership and atomically consumes the challenge once. Sync sessions last twelve hours, store only a token hash on the server, and remain in browser memory. Bank account requests require a separate single-use proof bound to currency. Neither proof signs a transfer.

## Encrypted storage

Each wallet has one AES-GCM encrypted snapshot. Record names and values are inside the ciphertext; wallet identity, ciphertext length and revision remain visible to the server. The wallet-derived encryption key stays in memory. This protects data at rest, not against malicious JavaScript executing in an unlocked browser.

Existing local sen1 records migrate after successful decryption. Legacy plaintext is claimed once on that browser, then removed only after an encrypted local snapshot has been stored. Server-side legacy rows are retained for recovery; administrators may remove them after confirming migration. This release does not silently delete those backups or claim that historic metadata is erased.

Each server write compares its expected revision atomically. Conflicts preserve local data and pause writes with a visible notification. There is no automatic merge of financial records. Preserve the local ciphertext before operator-assisted reconciliation; do not clear browser storage to dismiss a conflict. Failed or uncertain writes also pause until a fresh unlock. Deletions are represented inside the encrypted snapshot. Wallet changes clear memory and reload the desk to reset React state.

## Provider onboarding

There is no public endpoint for assigning Bridge customer identities. Trusted onboarding must verify the customer's provider status and wallet ownership, then provision `bridge_wallet_customer` with that wallet, its unique provider customer ID and verification time. Revocation sets `revoked_at`. Keep this table under operator access control; do not populate it from an unverified browser request. Do not reuse a shared `BRIDGE_CUSTOMER_ID`.

The server needs `BRIDGE_API_KEY`. Unbound or revoked wallets fail closed before any provider request. Successful account requests use the bound customer and signed destination, stable idempotency keys and a 15-second timeout. Currency/rail availability is determined by the provider. The UI displays returned account details; this code change does not activate bank credentials, issue a card or establish provider approval.

## Validation

`npm test` includes real Ed25519 proofs, replay/concurrency/expiry tests against PGlite, session isolation, customer revocation, stale-write rejection and client encryption/migration/deletion/conflict tests. Generate routes with `npm run build:dev`, then run `npm run typecheck` on a clean checkout. These are local implementation checks, not a third-party audit or live banking test.
