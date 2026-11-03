# Senda / PARRALAX / Organism API gateway

**Status: PARTIAL — gateway source committed, upstream PARRALAX HTTP routes not yet verified, not deployed.** This is a private server-to-server adapter, not a browser API, execution engine, wallet, settlement authority, broker connection or smart contract.

## Rationale

Senda owns user sessions, wallet signing, Jupiter and customer-facing workflows.
PARRALAX owns signals, portfolio risk, execution plans, governance decisions, and receipts.
PARALLAX Exchange Clearinghouse owns netting, margin, settlement planning, ledger reconciliation.
Organisms submit bounded typed requests; none receive secret keys or signer authority.

## Files

- `contracts.mjs`: allowlisted versioned capability contract.
- `gateway.mjs`: server-to-server upstream relay, fail-closed permission checks, timeout, provenance and structured audit hooks.
- `server.mjs`: private Node HTTP interface.
- `client.mjs`: server-only Senda call helper.
- `gateway.test.mjs`: denied authority, upstream failures and contract validation tests.

## Gateway HTTP interface

`GET /healthz` — process status (does not establish upstream readiness).

`GET /v1/capabilities` — requires service bearer token.

`POST /v1/proposals` — requires service bearer token and verified `x-senda-principal` **issued by a trusted Senda backend**. Do not accept this header directly from browsers or agents.

Request:
```json
{
  "schema": "senda.parralax.request.v1",
  "requestId": "unique-request-123",
  "organismId": "approved-organism-1",
  "action": "risk.evaluate",
  "payload": { "instrument": "SOL", "notionalUsd": 100 }
}
```

The `schema` field is retained in client packets and checked downstream; the incoming gateway validates IDs, action and payload. Service principals and organism permissions must be managed in Senda's trusted control plane; `SENDA_ORGANISM_PERMISSIONS_JSON` is a static bootstrap allowlist, not self-service authorization.

## Required PARRALAX upstream contract

These paths are **proposed adapter paths**, not verified existing PARRALAX routes:

| Action | POST path | Authority |
| --- | --- | --- |
| market.research | /v1/market/research | research |
| risk.evaluate | /v1/risk/evaluate | risk |
| execution.plan | /v1/execution/plan | plan only, never submit |
| receipt.verify | /v1/receipts/verify | audit |
| clearing.trade_validate | /v1/clearing/trade-validate | audit |
| clearing.net | /v1/clearing/net | operator review required |
| clearing.margin_evaluate | /v1/clearing/margin-evaluate | risk |
| clearing.settlement_plan | /v1/clearing/settlement-plan | plan only |
| clearing.receipt_verify | /v1/clearing/receipt-verify | audit |
| clearing.ledger_snapshot | /v1/clearing/ledger-snapshot | audit |
| clearing.handoff | /v1/clearing/handoff | operator review required |

Upstream responses must include `{"schema":"parralax.response.v1","requestId":"same-request-id"}`; a positive gateway response means an upstream request was acknowledged, **not** that an order filled, collateral transferred or a claim settled. PARRALAX must implement each operation with its own policy enforcement, audit persistence, idempotency storage and verified execution receipts before production use.

## Environment (server only)

```dotenv
HOST=127.0.0.1
PORT=8787
SENDA_GATEWAY_CALLER_TOKEN=<32-plus-character-secret-from-secret-manager>
PARRALAX_UPSTREAM_URL=https://private.parralax.example
PARRALAX_UPSTREAM_TOKEN=<server-to-server-credential>
SENDA_ORGANISM_PERMISSIONS_JSON={"organism-1":["research","risk","plan","audit"]}
```

Do not put tokens in Vite `VITE_*` variables, browser localStorage or committed .env files. The example hostname is **not a real endpoint**.

## Start and test

```sh
node --test integrations/parralax/gateway.test.mjs
node integrations/parralax/server.mjs
```

Example server-side Senda call (never in React code):
```js
import { createParralaxClient } from "./integrations/parralax/client.mjs";
const api = createParralaxClient({ gatewayUrl: process.env.SENDA_PARRALAX_GATEWAY_URL, callerToken: process.env.SENDA_GATEWAY_CALLER_TOKEN });
const result = await api.propose("verified-principal-1", { requestId: "r-001", organismId: "organism-1", action: "market.research", payload: { mint: "SOL" } });
```

## Non-negotiable production gates

1. Bind `x-senda-principal` to server-validated authentication and tenant membership. Network access must be private; use ingress auth/mTLS and rate limiting. Never expose this Node service directly to the internet.
2. Persist requests, decisions, idempotency keys and audit receipts in a durable store. Current audit callback writes to stdout only; not sufficient for financial-grade evidence.
3. Connect live PARRALAX route handlers and publish a compatible OpenAPI schema; add real upstream contract tests.
4. Add per-tenant/organism budget tracking, quotas and resource guards in a durable store; static permission arrays alone are insufficient for financial permissions.
5. Separate upstream risk/plan/clearing hosts and give each service the minimum credential required. Replace single-token upstream configuration before enabling multiple trust domains.
6. Run integration and load tests, TLS/mTLS, secret rotation, observability and operational runbooks. Confirm exact network deployment and queue semantics.
7. Never grant `execution.submit`, `wallet.sign`, `clearing.settle` or `collateral.withdraw` through this gateway. Actual wallet transactions remain user-signed under Senda.
8. Validate external market data and cross-check settlement/chain receipts. A source response is not proof of filled execution.
