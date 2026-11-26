# SENDA Event Intelligence Service

**Status: protected Vercel preview READY with 19/19 isolated tests; provider runtime and production activation not certified.** Standalone read-only API product extracted from Senda Markets V3 and Contingency Lab. This service is designed for Senda, SendaPay, Kiln workflows, internal AI agents and other approved backends.

### Capabilities
- `GET /v1/health` — public liveness, not provider readiness
- `GET /v1/ready` — authenticated live Kalshi provider probe, explicitly separate from process health
- `GET /v1/capabilities` — exact authorized read-only service contract
- `GET /v1/markets?q=&lane=&sort=&limit=&cursor=` — one official Kalshi events-index page, with cursor and explicit incompleteness
- `GET /v1/markets/:ticker` — verified market rules, status, close and venue statistics
- `GET /v1/markets/:ticker/book` — source-derived opposing YES/NO bids, no executable quote
- `GET /v1/markets/:ticker/history?window=24h|7d|30d` — actual Kalshi candle close and native volume, null when unreported
- `POST /v1/contingency/scenario` — fresh public order book + deterministic **four independent market-resolution × real-world-loss** states, before unknown fees
- `POST /v1/contingency/reserve` — separately calculates a self-funded cash buffer, without assuming any event payout

All endpoints except /v1/health require `Authorization: Bearer <server-held API key>`. **No public/browser client should receive the key.** API never constructs trades, signs wallets, transfers USDC, pays bills, issues insurance or submits Kalshi orders.

### Design
```text
Senda market UI / SendaPay backend / agent
                  |
        Private authenticated API
                  |
    services/event-intelligence/
       api/index.mjs       Vercel entrypoint
       src/node-adapter    Node HTTP transport
       src/service         auth / bounds / request policy
       src/provider        Kalshi fixed host / source timestamps
       src/*-core          canonical market + contingency logic
       sdk/client.mjs      Node server-only client
                  |
       Kalshi public read-only endpoints
```

Senda's original `src/lib/event-contract-router.mjs`, `src/lib/contingency-analysis.mjs`, `src/lib/event-market-discovery.mjs`, and `src/lib/kalshi-history-core.mjs` re-export the **single canonical service modules**. Their TypeScript declarations stay at the application import paths. This prevents drift between Senda UI calculations and third-party API calculations.

### Local operation (Node 22)
```bash
cd services/event-intelligence
npm ci
npm test
npm run build
# Generate and store a cryptographically random secret using your approved secret manager.
# Store it as SENDA_EVENT_API_KEYS in the server environment; never commit or paste it in a PR.
PORT=8080 npm start
```

Use the API only with authorized server-to-server credentials. No default or demo production credential is included.

```bash
curl -fsS http://127.0.0.1:8080/v1/health

curl -fsS -H "Authorization: Bearer ${SENDA_EVENT_API_KEY}" \
  "http://127.0.0.1:8080/v1/markets?q=weather&limit=10"

curl -fsS -X POST -H "Authorization: Bearer ${SENDA_EVENT_API_KEY}" \
  -H "content-type: application/json" \
  -d '{"potentialExpenseUsd":1500,"availableCashUsd":500,"targetCoveragePct":75}' \
  http://127.0.0.1:8080/v1/contingency/reserve
```

### Separate Vercel project
Create a **new** Vercel project for the existing `ItsNotAILABS/Senda` GitHub repository; set Root Directory to **`services/event-intelligence`**. The checked-in `vercel.json` routes `/v1/*` to the Node function. Framework: **Other**. Build command: `npm run build`, install command: `npm ci`. Deploy to preview first, review the exact commit, then promote only the tested production build.

Set `SENDA_EVENT_API_KEYS` in Vercel **encrypted/sensitive project environment**, with one 32–200-character high-entropy bearer key (or comma-separated keys for rotation). Share a separate credential through a secret manager with **each approved backend**; store in SendaPay server env only as `SENDA_EVENT_API_KEY`. Never use `VITE_*` or publish it in `.env`, the frontend, screenshots or source code.

**No automatic production deployment or domain claim occurs from this repository change alone.** External deployment requires authorization of the target Vercel project and passing its build/preview checks.

### Example SendaPay backend integration (no SendaPay code modified)
```js
import {createSendaPayContingencyBridge} from "./integrations/sendapay/event-intelligence-client.mjs";

const service=createSendaPayContingencyBridge({
  serviceOrigin: process.env.SENDA_EVENT_SERVICE_ORIGIN,
  serviceKey: process.env.SENDA_EVENT_API_KEY,
});

const reserve=await service.planIndependentCashReserve({
  potentialExpenseUsd:1500,availableCashUsd:500,targetCoveragePct:75
});
// reserve is research-only. Do not use to initiate payments or move customer funds.
```

The adapter assumes **no** SendaPay login, wallet, ledger, payment rail, virtual card, KYC system or proprietary API. SendaPay's live implementation and authentication contract must be inspected with its maintainer before wiring a real backend route. **A payment receipt is not created by this service.**

### Security and operational limits
- Fixed Kalshi HTTPS provider only; validated tickers, timeouts, response-size limits and low-TTL deduplication/cache.
- Server-only API credentials, SHA-256 comparison with constant-time digest comparison, no credential reflection, no CORS wildcard, no GET trading endpoints and no payment functionality.
- Input size ≤15 KB; up to 40 authenticated requests per key per minute and 120 across the instance, locally enforced. Multi-instance production deployments **require durable quotas** or an external authenticated gateway; these local limits alone are **not sufficient for high-scale/enterprise use**.
- API receipts are deterministic SHA256 response digests that are **NOT durable, on-chain, externally attested, or proof of Kalshi settlement**. Persist/audit externally if contract evidence matters.
- A public order book can become stale. Executable taker quotes, fees, market availability, jurisdiction/age eligibility, and settlement confirmation require separate permitted provider agreements.
- The contingency calculator models a **prediction contract**, not insurance. Genuine parametric insurance requires licensing, underwriting, reserves, policy/claims administration, and legal clearance.
- Do not log user amounts or secrets. Apply IP/WAF limits and observability at the cloud edge. Scope and rotate keys per backend, do not share one globally.
- CI should run `npm test`, `npm run build`, plus the Senda source-level market tests. Run verified provider contract tests before production launch.

### Source references
- [Kalshi public Events](https://docs.kalshi.com/api-reference/events/get-events)
- [Kalshi Market](https://docs.kalshi.com/api-reference/market/get-market)
- [Kalshi Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook)
- [Kalshi Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks)
- [OpenAPI contract](./openapi.json)

### Provider certification and safe launch

Call `GET /v1/ready` with a server-managed bearer token after the protected preview is reachable. Its response actively verifies the public Kalshi events source; `GET /v1/health` only proves the process responds. Neither endpoint claims account access, tradability, settlement, real insurance, or SendaPay integration. The isolated tests use explicitly synthetic test fixtures and do not substitute for actual Kalshi API verification.

For production-scale usage add an approved distributed rate-limiting/identity gateway and a secure audit-event store, then perform real current-provider contract testing and account-specific eligibility review. Current in-process token budgets are a per-instance guard, not a cross-region spending control.

### Current verified preview

Protected preview: https://senda-event-intelligence-n4osxpom8-q7qx6fvztq-9008.vercel.app (deployment `dpl_4UPfqYYwnFeT1rapqt96Am39bEHh`). Vercel logs report `npm ci`, `npm run build`, and **19/19 tests passed**, including HTTP rewrite and fail-closed transport tests. This was uploaded as an isolated files-based Vercel preview, not activated by Git push. Neither this READY status nor the mocked provider tests establish successful authenticated runtime requests or live Kalshi quote certification.

The Kalshi candle provider now resolves `series_ticker` from the owning **Get Event** response, checks the market ticker is actually a member of the returned event, and refuses mismatches. A secured `GET /v1/ready` endpoint actively probes the current public source once credentials are configured; `GET /v1/health` remains process liveness only.
