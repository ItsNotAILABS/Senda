# Phantom × DFlow Prediction Execution — Senda integration architecture

## Two separate trading models

1. Phantom US Predict (Kalshi regulated account). Phantom onboards the user, Kalshi performs account and market operations, and the Phantom mobile app authorizes and submits orders. A Senda Solana wallet connection does not import this account or give Senda access to the mobile Predictions SDK. Senda does not intercept app traffic or operate hidden private interfaces.
2. DFlow on-chain Kalshi-linked outcome tokens. DFlow's Metadata API maps exact Kalshi event tickers to verified Solana outcome mints. Its Trade API returns a transaction the connected Phantom wallet can sign. DFlow operates an asynchronous CLP order: submission, open, pendingClose, then closed, expired or failed. Tokenized outcomes and redemption are not the same as balances and payouts in the Phantom US Kalshi account.

The second model is implemented as a **separate, explicitly gated** execution route in this branch. It is not a way to copy existing Phantom Kalshi account permissions.

## Source implementation

- src/lib/dflow-prediction-core.mjs — strict market ticker, mint identity, active market, quote and Proof eligibility validation; no invented outcome mints.
- src/lib/dflow-predictions.ts — server-only live DFlow metadata, Proof verification, jurisdiction eligibility and transaction-building endpoints. The integration never exposes provider API keys to browser JS.
- src/lib/dflow-prediction-sign.ts — the actual user-wallet Phantom transaction signing path. Deserialize Solana transaction, verify only one required signer and fee payer matches wallet, recheck quote freshness, simulate, ask Phantom to sign and submit. Never send a private key to a server. Requires unlocked Senda encrypted storage before signing.
- src/lib/dflow-prediction-receipt.mjs — wallet/market/side-scoped local async transaction journal. A Solana broadcast signature is NOT a DFlow fill. Only DFlow status closed is a completed order; pending, open, pendingClose remain unresolved.
- src/components/dflow-phantom-prediction.tsx — on-chain prediction quote, KYC, receipt and Phantom signing UI. Displayed as a distinct execution provider inside /social/events.
- src/lib/phantom-prediction-sign.ts — separate read-only Phantom signMessage research acknowledgment, not a trade.
- src/lib/kalshi-depth.ts — public market-book data for pricing research; not proof of an on-chain DFlow route or usable outcome mint.

## What makes production orders possible

Set the following **server-side only** and deploy with private configuration:

- SENDA_DFLOW_API_KEY — DFlow production API key from the provider. Never check into Git or put in the browser bundle.
- SENDA_DFLOW_EXECUTION_ENABLED=true — separate production release switch. Defaults disabled.
- SENDA_DFLOW_PARTNER_APPROVED=true — enable only after documented partner/business/commercial approval, not based on automatic public API reachability.
- SENDA_DFLOW_ALLOWED_PROGRAM_IDS — comma-separated, independently reviewed DFlow/CLP program IDs that are explicitly permitted in wallet-bound orders. No configured IDs means execution is unavailable.
- SENDA_DFLOW_ELIGIBILITY_API_URL — HTTPS origin of a Senda-controlled compliance provider delivering an independently verified wallet-specific eligibility verdict.
- SENDA_DFLOW_ELIGIBILITY_API_KEY — private credential for that eligibility provider.

The eligibility service must return wallet matching the requesting address, approved:true, ageVerified:true, jurisdictionApproved:true and an expiresAt timestamp in the following 24 hours. A client toggle, VPN IP, wallet country setting or unverified form is **not** a valid substitute.

Senda checks GET https://proof.dflow.net/verify/{wallet}; a Proof-verified wallet is required before purchasing outcome tokens. The optional Proof hosted KYC flow requires a Phantom signature over exactly Proof KYC verification: {timestamp}, then opens the official https://dflow.net/proof hosted form. Proof is a separate wallet identity system and existing Phantom US/Kalshi onboarding does not necessarily imply a DFlow Proof association.

Production metadata: https://api.prod.dflow.net/api/v1/market/{ticker}
Production trade order: https://quote-api.dflow.net/order
Async order status: https://quote-api.dflow.net/order-status
Never use the DFlow dev hostname to claim a testnet trade: their unauthenticated dev API also executes mainnet-beta transactions.

The MVP limits buys to $1–$250 USDC, slippageBps=100, predictionMarketSlippageBps=100, small priority fee and a 15-second order preview. It requires exact raw inAmount and output mint mapping to market metadata. Orders with missing positive minimum outputs, invalid serialization or unexpected fee payer are rejected before signature. The signer rejects any program ID outside reviewed DFlow IDs plus basic Solana system/token/compute programs, and rejects legacy or address-lookup transactions that cannot be fully inspected with this adapter. This is a conservative initial guard; additional independent program-audit evidence, resolution of legitimate address lookup tables, provider response authenticity and simulation reconciliation are still required before turning on production. The release gate must remain OFF until then.

## Important user experiences

- User already in Phantom mobile US Predict: open the native Predict tab and use its own approval and fee flow; Senda does not place orders using this session.
- User using Senda + Phantom browser: connect wallet; optional Senda research signature; DFlow adapter is shown as a separate on-chain option. When provider/Proof/compliance checks are complete, user obtains a fresh DFlow order, reviews exact USDC spend and mints, then deliberately signs with Phantom.
- An unknown status is NOT treated as a fill. Users should check the Solana signature and DFlow order status before retrying. Unresolved local receipts block identical repeated requests.
- Never burn or route Phantom-owned outcome tokens through an ordinary cleanup tool.
- Weather/disruption event contracts remain event-linked investment exposures, not insurance/indemnification policies. Native parametric insurance requires separate legal, claims, issuer and payout structure.

## Testing / release gate

Run from repo root:

    node --test scripts/phantom-prediction-intent.test.mjs scripts/dflow-prediction-core.test.mjs scripts/dflow-prediction-receipt.test.mjs scripts/event-contract-router.test.mjs
    npm ci
    npm run typecheck
    npm run build:dev

Then perform browser wallet QA inside Phantom mobile on a whitelisted proof-verified wallet, inspect real DFlow metadata and quote and signed transaction instructions against allowlisted DFlow programs, test insufficient USDC and slippage, and reconcile pending/closed/expired/failure paths against authenticated provider records. Do NOT mark the route live or advertise Phantom Kalshi account interoperability until provider/legal/security approval, full CI, and those tests pass.
