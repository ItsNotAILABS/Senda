# PARRALAX financial backend client for Senda

Senda already includes wallet-signed Jupiter spot/perps and other venue-specific code. This module is a **server-only research/risk/exit-planning connection** to a separate financial backend in `ItsNotAILABS/PARRALAX-AIHFTFUND/services/senda-finance`. No existing Senda UI or wallet code is replaced.

Status: PARTIAL / not deployed. Requires a privately reachable PARRALAX instance and real signed/attested venue quote adapters.

Example:
```js
import {createFinanceClient} from "./client.mjs";
const parralax=createFinanceClient({
 origin:process.env.PARRALAX_FINANCE_ORIGIN,
 token:process.env.PARRALAX_FINANCE_SERVICE_TOKEN
});
const response=await parralax.risk("unique-request-id",{
 instrument:"SOL",side:"long",notionalUsd:100,maxNotionalUsd:500,
 leverage:2,maxLeverage:3,quoteAgeMs:100,maxQuoteAgeMs:2000,
 priceImpactBps:20,maxImpactBps:80,oracleHealthy:true,
 venueEligible:true,walletAuthorized:false
});
```
Passing the risk check does not authorize trading, because the separate wallet signature and exchange-specific eligibility remain required. The example above intentionally returns a denial.

For exits, useFor organism spending proposals, use `parralax.budgetEvaluate(requestId, evidence)` with a backend-issued verified policy, ledger snapshot, unused nonce, approved beneficiary and atomic budget reservation in a durable store. This endpoint decides whether a proposal is within policy, not whether a transfer has occurred. **No organism receives the wallet's signing key.**

 `parralax.exitPlan(requestId, payload)`, with authenticated server-observed, venue-specific data. The PARRALAX service reports *analysis only*, not a guaranteed filled order. Perpetual positions can only be reduced/closed on their original margin venue. Do not trust agent-provided `verified: true` flags as evidence: upstream ingestion must independently verify a quote and its origin.

Do not expose `PARRALAX_FINANCE_SERVICE_TOKEN` to the browser. Connect from Senda server functions only after tenant/session authentication and request quotas; use mTLS/private ingress for production.

Deployment requirements: durable audit storage, issuer-controlled agent authority, per-tenant budgets, source-signed quote attestations, verified venue execution adapters, wallet signing, confirmation and reconciliation. Neither fake liquidity nor made-up bank rails are acceptable.
