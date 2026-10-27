# Senda Liquify — Go quote intelligence service

This is **read-only quote infrastructure**, not an order book, exchange, trading backend, pool or wallet custodian.

## Start locally

```bash
cd services/liquify
go test ./...
SENDA_ROUTER_LISTEN=127.0.0.1:8787 go run .
curl -s 'http://127.0.0.1:8787/healthz'
```

By default the service only listens on loopback; no public binding is accepted without `SENDA_ROUTER_INTERNAL_KEY`. Enable production traffic only through private ingress and authentication.

## Endpoints

- `GET /healthz`: service availability (does **not** guarantee Jupiter is reachable).
- `GET /v1/quote?inputMint=...&outputMint=...&amount=...`: source-verified Jupiter Swap V2 **quote only**. `amount` is an integer in the smallest input token unit. Only USDC/token pairs accepted.
- `GET /v1/ladder?mint=...`: samples $5/$25/$100/$250 USDC → token quotes with bounded goroutines, six-second upstream deadlines, and keyless 0.5-RPS pacing.

A quote-only Jupiter V2 call omits `taker`; the API **does not deliver a signed executable transaction**. The absence of a routing result is preserved as unavailable. Quotes have timestamps and are never treated as resting orders, maker bids, guaranteed executable liquidity, market-maker commitments or settlement confirmations.

The Go service can be called by the **Senda server**, never exposed with its internal secret to frontend JavaScript. Never send a wallet key or secret to the service.

## Environment

- `SENDA_JUPITER_API_KEY`: optional server-side developer key, enables higher authenticated request limits; not stored in the browser.
- `SENDA_ROUTER_LISTEN`: defaults to `127.0.0.1:8787`.
- `SENDA_ROUTER_INTERNAL_KEY`: mandatory if binding beyond loopback; use an organization secret and a private network.

App-side server adapter: configure `SENDA_LIQUIFY_ORIGIN=http://127.0.0.1:8787` and matching `SENDA_ROUTER_INTERNAL_KEY` in the **app server environment**. This is a read-only route. If not configured or if the backend is offline, the desk explicitly shows route unavailable. Do not silently fall back to an unrelated price feed and call it executable liquidity.

## Production certification needed

- Private origin, TLS at ingress, origin allowlist and rotation of shared secrets.
- Authenticated client/session and global ingress rate limits; service-side pacing is not a full public DDoS defense.
- Durable observability for latency, 429 rates, no-route responses, route availability at each size and quote-to-fill comparisons.
- Multivenue support only from legitimate direct RFQ, maker or venue interfaces with signed integration agreements. Jupiter V2 already competes Metis, JupiterZ, Dflow and OKX where available. Don't double-count a Jupiter quote as four independent pools.
- Wallet-owned transaction signing and official Jupiter V2 `/order` + `/execute` flow require a separate reviewed execution integration and confirmation reconciliation. The service intentionally does **not** mint, swap, deposit, fund pools, operate margin, or sign transactions.
