# Senda Event Intelligence service — integration receipt

Status: **SOURCE MERGED / PREVIEW BUILT / PRODUCTION AUTHENTICATION AND PROVIDER TESTS PENDING**.

The service is isolated in `services/event-intelligence/`; it includes an OpenAPI spec, authenticated Node REST API, source-backed Kalshi public market/contract/history readers, non-insurance contingency analytics, and a SendaPay-facing **server-only adapter**. No funds move and no wallet signature or Kalshi order is created. The existing Senda Events UI, payment signer and core market calculations are not replaced by this source carry-forward.

## External preview evidence
- Project: `senda-event-intelligence`; Vercel project `prj_7ce2eLN5SGusFStTASRMfRa7bjgx`.
- Verified through Vercel deployment inspection on 2026-11-26: preview deployment `dpl_4ArsTToXgUP3zam4kbXjA7Ryqmxh` reports `READY`, URL `https://senda-event-intelligence-nso8l02o0-q7qx6fvztq-9008.vercel.app`. This does **not** confirm authenticated runtime endpoints or a production alias.
- PR #51 reports 10/10 isolated Node API tests on the preview builder; GitHub Actions and full Senda TS build are not independently green.
- Source service manifest remains descriptive and says `not-deployed`; it predates the preview. **Do not mistake preview READY for public operational activation.**
- `SENDA_EVENT_API_KEYS` is not verified configured. Service must fail closed without private credentials; do not publish a browser token.

## Release steps
1. `cd services/event-intelligence && npm ci && npm test` and confirm runtime/endpoint contract with a private caller.
2. Verify current Kalshi public API fields/freshness, invalid tickers, absent candles, market depth and source status. Never synthesize volume.
3. Configure secret manager, tenant-bound service identity, rate limits, logs and protected private ingress; do not expose data/secret in client JavaScript.
4. Confirm SendaPay uses a **server-to-server** integration rather than a browser fetch and has a separate verified financial settlement/ledger authorization layer.
5. Promote only a signed and reviewed build after platform readiness checks; no production domain changes were performed in this carry-forward.
6. Prevent policy logic divergence between the isolated service source and app's `src/lib/` source by reviewing shared tests before release.

Nothing in this service constitutes a licensed insurance claim, market settlement or an executable event-market order.
