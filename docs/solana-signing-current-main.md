# Current-main Solana signing hardening

This branch is based on Senda's October 22 `main` rather than merging the older Jupiter-security branch across a large UI/financial code rewrite.

## Swap execution

- Requests Metis ExactIn quote and swap payloads only through the official `api.jup.ag` gateway. It deliberately does not send wallet intents through unaudited public reverse proxies or the retiring Lite API.
- The exact quote object passed into Jupiter's swap transaction builder is validated before wallet prompting: input/output mint, raw input units, route shape, ExactIn mode, 100 bps slippage, finite price impact no greater than 5%, u64 bounded amounts, and an output minimum that actually respects the requested 100 bps slippage.
- Validates requested raw USDC spend against the configured USD cap rather than relying on caller-supplied display estimates; SOL/token input needs a separately trusted dollar valuation.
- Removes the builder-side dynamic slippage override; checks the deserialized transaction fee payer against the connected owner.
- Preserves the newer Senda main branch's `quoteRoute`, `signRoute`, `signStockSwap` contracts and the separate `runPrestock` activity pipeline.
- A wallet/RPC signature alone cannot return successful swap completion: a confirmed/finalized on-chain status with explicit `err: null` is required.

## Payments

- Main's `payUsdc` and `paySol` also wait for the exact signature's on-chain confirmation before returning a successful receipt.
- Pending, transient RPC failures, missing execution result, or an on-chain error do not create success responses. Returned errors include the signature to guide reconciliation before a second attempt.

## Validation and limits

Pure helper tests:

```sh
node --test scripts/quote-guard.test.mjs scripts/confirmation-gate.test.mjs scripts/payment-confirmation.test.mjs
```

Before merging, run `npm ci && npm run typecheck && npm test && npm run build:dev` and wallet-injected Solana devnet/mainnet controlled transaction tests in a trusted checkout. This session did **not** run full repo checks or sign a live transaction. Local confirmation proves a transaction landed at a selected commitment, not that every action is finalized. A timeout can precede later settlement and must not lead to blindly repeated signatures.

The application is still a noncustodial interface: the wallet holds assets and retains final signing authority. The quote guard and payer check are **not** an instruction-level audit of a third-party swap transaction. Stronger authorization needs a verified instruction allowlist or third-party contract audit. Mainnet prices / eligibility / compliance and usable server-side API quotas must be verified independently; `api.jup.ag` keyless traffic is heavily rate-limited. No server API key belongs in browser code.

This is the clean successor to the signing/confirmation pieces in draft PR #3; the broader old branch is still a separate, conflicting integration task, not merge-ready.