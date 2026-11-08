# Prediction Provider Contract Hardening — November 6, 2026

This is a **correctness pass**, not a new live venue. It is stacked on PR #37 (which is stacked on #34). No signed transactions or customer trading credentials were used for testing.

## Problems fixed

1. The Phantom/phone wallet code imports `tweetnacl`, `bs58` and `buffer`, but these were not all top-level dependencies in Senda. The application now pins them explicitly in `package.json` and `package-lock.json`; Node and Vite should not depend on accidental transitive hoisting for wallet operations.
2. New prediction-only Phantom signature verification now uses browser-native WebCrypto Ed25519 + strict base58/base64 codecs rather than importing more undeclared dependencies. The core Phantom mobile wallet still uses `tweetnacl` for its existing box/secretbox functionality.
3. DFlow's documented market structure can expose outcome mints in `accounts.usdc.yesMint/noMint`; earlier code looked only for `accounts[USDC_MINT]`. The parser now supports the documented account key and checks ISO or numeric close times.
4. A quote requiring `submitEndpointRequired`, additional transaction signers, unsupported transaction versions or unresolved address lookup tables cannot yet be sent through Senda's normal Solana broadcast path. These cases now fail closed before asking Phantom for approval, rather than producing an unusable or misdirected transaction.
5. DFlow Phantom connection now unlocks the canonical wallet-scoped encrypted recovery store, avoiding a misleading enabled trade action with an unopened journal.

## Provider requirements before LIVE

DFlow `GET /order` is the official quote-and-transaction builder. Respect `transactionVersion`, `submitEndpointRequired`, `lastValidBlockHeight`, `predictionMarketInitPayerMustSign`, `destinationWalletMustSign` and `addressLookupTables` in provider responses. Do not drop fields or re-serialize them as a different program. The current signer deliberately rejects cases it cannot inspect and submit reliably. Supporting sponsored/multi-signer transactions, v0 lookup tables and provider `POST /submit-transaction` requires a distinct tested lane with explicit signers and a vendor-attested transaction path.

The **Proof** verification message and redirect are documented by the official DFlow Proof integration. The callback must re-check `GET /verify/{address}`; never trust query string verification claims. A Proof-verified wallet alone does not establish user/region eligibility, production API authorization or valid event contract rules.

## Testing

Run `node --test scripts/ed25519-wallet.test.mjs scripts/dflow-prediction-core.test.mjs scripts/dflow-prediction-receipt.test.mjs scripts/prediction-venues.test.mjs scripts/polymarket-catalog.test.mjs scripts/polymarket-depth.test.mjs`.

Run `npm ci && npm run typecheck && npm run build:dev` with a functioning GitHub runner. After compile, test a genuine DFlow production response **without sending a transaction** and verify correct account mints, fee payer, token account destinations, programs and lookup tables. Follow with authorized Phantom mobile testing in a supported market/region. Do not enable SENDA_DFLOW_EXECUTION_ENABLED until the partner/compliance/production venue checks pass.

Current GitHub Actions runs have reported zero assigned runner and zero executed steps, so they do not prove successful or failed unit tests. Repository Actions administration/billing/runner availability must be resolved to establish a real build certification.
