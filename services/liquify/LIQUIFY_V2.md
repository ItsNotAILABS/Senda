# Senda Liquify V2 — advanced routing intelligence

**Status: partial source implementation, read-only, not independently certified against live venue environments.** Senda's existing Phantom/Jupiter trade execution is unchanged.

## Upgrades over the previous limitations

| Previous limitation | V2 change | Honest remaining boundary |
| --- | --- | --- |
| USDC-only quote pairs | `/v1/quote` and `/v2/compare` now accept two distinct valid Solana mints and bounded raw input | Provider still must support the pair and raw input; no guaranteed route |
| No multi-venue aggregation | `/v2/compare` requests Jupiter V2 and up to six separately configured independent HTTPS quote adapters | Not automatic exchange integrations; additional providers must actually be deployed and configured; no combining maker quotes into a synthetic fill |
| No pool-level math | `/v2/pool/impact` reads token-vault reserves from independently configured Solana JSON-RPC, then computes integer constant-product fee-adjusted output and impact | **Scenario only:** vault pair is user-supplied; AMM pool authority, fee tier and reserves-to-market mapping are *not* verified. Concentrated liquidity and RFQ curves differ |
| Solscan five-page volume cap | Default ten pages, bounded configurable cap to 30; result exposes fetched pages/rows, page cap and truncation | Still **lower-bound** activity index subject to source API coverage/lag; no false zeros |
| No Go quote caching | TTL cache (1.5 seconds) per venue, pair and raw amount; 512-entry bound | Quotes may be stale immediately. The user must re-quote through the official execution API before signing |
| Not a DEX indexer | Separates route comparisons, reserve scenarios and actual indexed swap observations | Not a full indexer. Verified pool registry, RPC streaming, backfill and reorg-aware persistence remain future work |

## API endpoints

### `GET /v2/compare?inputMint=...&outputMint=...&amount=...`

Only the **private Senda server** may call this endpoint using `X-Senda-Router-Key`. Response contains source-specific `routes`, explicit `rejected` sources, `cacheAgeMs`, `observedAt`, `executionEnabled:false`. Routes are ranked by raw output quantity for the same exact input/output tokens; venue fees, transaction success, gas, eligibility, and settlement may still change economic outcome. Jupiter internal routers are one composite Jupiter source, never four independent venues.

### `GET /v2/pool/impact?inputMint=...&outputMint=...&amount=...&inputVault=...&outputVault=...&feeBps=...`

Reserves come from `getMultipleAccounts` on `SENDA_SOLANA_RPC_URL` with `confirmed` commitment. Legacy SPL token accounts and mint matches are checked. Output is a **CPMM scenario** using arbitrary precision integer math, never an executable quote, without claiming AMM pool-owner verification. Calling this with random vault accounts is not proof of a trading pool.

### `GET /v1/volume?mint=...&tf=1H`

Returns source-labeled Solscan index with `pages`, `pageCap`, `rowsFetched`, `pageLimitReached`, `complete` and bar series. SOL-native and USDC-native units stay separate. Partial failed page fetches are marked incomplete and do not fabricate empty volume.

## Venue configuration

The Go service defaults to Jupiter only. To enable independent quote sources, deploy a controlled service-to-service quote adapter and configure a JSON array in the **server environment**, never in frontend assets.

```text
SENDA_LIQUIFY_VENUES_JSON=[{"id":"independent_venue","url":"https://quotes.your-private-approved-provider.example","key":"managed-server-secret"}]
SENDA_ROUTER_INTERNAL_KEY=<server-only-random-secret>
SENDA_SOLANA_RPC_URL=<trusted-https-solana-rpc>
SENDA_SOLSCAN_PRO_API_KEY=<server-only-key>
SENDA_SOLSCAN_PAGE_CAP=10
```

The provider adapter must implement `GET /quote`, accepting `inputMint`, `outputMint`, `amount`; respond with `inputMint`, `outputMint`, `inAmount`, positive integer `outAmount`, `router`, and a recent `observedAt` RFC3339 timestamp. Invalid responses and unavailable venues are excluded. Never insert fabricated sample quotes into production.

**Security prerequisite:** The independent provider list must be fixed by a trusted operator. Before external deployments, pin approved hostnames, resolved IP ranges, certificate identities, auth scopes and outbound proxy rules to prevent DNS-rebinding and SSRF; do not allow end-users to set provider origins.

## UI

`/invest/routes` includes a Liquify V2 comparison surface. It shows raw amounts, venue availability and cache age while leaving the existing Jupiter trading board intact.

## Release verification

```sh
cd services/liquify
go test ./...
go test -race ./...
go vet ./...
# At repository root:
npm ci
npm run typecheck
npm run build:dev
```

Run the tests in CI with real logs. Check provider contract integration, tail latency, malformed quotes, RPC vault data validation, Solscan pagination, chain reorganizations, stale quote detection, address parsing, and frontend wallet simulation. Do not claim routing is production-ready until checks and integration receipts pass.
