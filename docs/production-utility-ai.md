# SENDA Utility AI — evidence-first research (October 28, 2026)

Path: `/agents/intelligence`. This is a **real browser interface and server code**, not a deployed or live-verified LLM until its configuration, CI and environment are proven.

## Capabilities

1. **Market analyst** accepts an exact Solana token mint, retrieves the PreStocks public feed (no synthetic SEEDS/fallback) and GeckoTerminal token-specific Solana pools, then reports independently sourced token price, provider mark, premium, pool reserve, indexed 24h pool volume and data gaps. PreStocks tokenized economic exposure must not be marketed as a share.
2. **Liquidity analyst** retrieves token-specific pools and reports the observed deepest pool's reserve, 24h volume and activity. This is research; **neither reserve nor past trading volume is an executable quote**.
3. **Transfer analyst** creates a verified checklist for USDC/USDT on Solana. It never constructs, signs, sends or broadcasts; USDT mint is intentionally not asserted until a verified registry is linked. USDC on Solana uses the existing mint constant.
4. **Structured AI narrative** is an optional actual OpenAI Responses API call, `POST /v1/responses`, using strict JSON schema. It receives only normalized source facts, risk text and decision steps. Outputs are validated against allowed evidence IDs, and invalid or incomplete outputs are rejected. The model has no tools, private keys, customer wallet balances or write authority.
5. **Portable receipt**: export research, source status, timestamps, risks and optional model interpretation as JSON to the local device.

## Configuration

This app never prompts the user for or stores an API key in browser data. The server-side environment supports:

```text
SENDA_UTILITY_AI_ENABLED=true
SENDA_AI_API_KEY=<secret on the app server>
SENDA_AI_MODEL=gpt-4.1-mini
```

The default is **model disabled**. Deterministic research still works with no model provider configured. Never commit secrets or make the model key available as a `VITE_*` variable.

Model access requires the existing Better Auth session through `authMiddleware`, and is disabled when `VITE_AUTH_ENABLED=false`. Global in-process budget: max two concurrent, six calls/minute, with 12 requests/hour per verified session. Public evidence collection is limited to 40 cache misses/minute per process; cache and in-flight deduplication reduce provider fetches. **In-process budgets are not durable or distributed across instances**; production scale requires an authenticated shared quota store or API gateway and observable billing.

## Evidence integrity and operating rules

- The server fetches only two fixed public providers: `https://prestocks.com/api/prestocks` and the validated-mint GeckoTerminal Solana pools endpoint. No arbitrary URL or browser-supplied HTTP host is accepted.
- Every observation includes an explicit source URL and observation timestamp; missing price/volume/liquidity means **unknown**, not zero.
- PreStocks mark and token price are not Jupiter execution quotes, shares, balances, guaranteed liquidity or achievable fills.
- Model explanations are *interpretive*. Grounded fact tiles remain authoritative. Evidence IDs are checked, but that does **not mathematically guarantee** that a natural-language conclusion faithfully reflects a cited fact; reviewers must inspect it.
- The agent has **no wallet signing**, payment, mint, token launch, perps, trade, debit-card, bridge, cross-chain transfer or persistent account mutation tools.
- The view does not read or transmit private wallet keys, recipient addresses, transaction history or user's personal identity to the model. Model narration is not persisted by the server (`store:false`). It is sent to the configured provider; appropriate user disclosure and privacy review are required before broad release.
- Source descriptions/names are untrusted input, not instructions. The model sees a normalized allowlist only; no web-browsing or tool calls are enabled.
- A raw source fetch failure is displayed as unavailable; no fallback listing, invented book, fake rates, or optimistic "done" receipt.

## QA

```bash
node --test scripts/utility-ai-core.test.mjs
npm ci
npm run typecheck
npm run build:dev
```

Additional gates before production: attach authenticated model key and budgets; verify actual PreStocks response shape and GeckoTerminal values; run negative provider/error and 429 tests; browser QA across wallet disconnected, signed out, signed in, and mobile; inspect CSP and outbound API traffic; add durable per-user budget and response/request tracing for multi-instance scale. No live model call or production deployment was performed as part of this source-only PR.

## Integration next steps

- Integrate `/agents/intelligence` with market instrument selection without using fixture/seeded balances or prices; only real verified mint IDs may be preselected.
- Attach real, timestamped Jupiter Swap V2 route quotes and RFQs as an independent executable-liquidity tool only after wallet-signing migration validation.
- Integrate Solscan recent USDC/SOL volume as a separate notional source once Liquify PR #17 is certified and merged. Do not sum it with Gecko pool volume.
- Add durable per-user research receipts, tool-call budgets and governed handoff to Agent Studio only after authenticated storage and evaluation receipts exist.
