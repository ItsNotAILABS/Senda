# Senda repository code audit — 2026-11-02

Audit base: 1521211c28e8669cb1e0c997b57fce364d62cf96. Static repository-wide inventory and critical-path source tracing, not a claim of every-line review, full build, penetration test, or live release.

## Repository inventory
GitHub recursive tree returned 729 blobs (not truncated): 162 src/components; 243 src/lib; 122 src/routes (118 TSX); 63 scripts; 16 chain; 6 Go service; 4 MCP; 9 migrations; 22 docs; 49 public. 47 files match normal test-file names. Public assets include the existing README banner, previews, videos, and OG artwork.

## Application and wallet boundaries
- src/routes/__root.tsx, src/components/app-shell.tsx: TanStack Start root, wallet/auth context, existing navigation. Preserve the current UX.
- src/lib/wallets.ts and src/lib/phantom.ts: wallet detection, mobile provider integration, signing, simulation and broadcasts. Installed wallet availability and mobile behavior remain environment-dependent.
- src/lib/jup-sign.ts and src/lib/quote-guard.mjs: Jupiter official v1 quote/swap, exact input mint, route and slippage checks. src/lib/wallet-execution-lock.mjs, src/lib/tx-journal.mjs, src/lib/tracked-confirmation.mjs: serialized signing, replay/duplicate recovery, chain confirmation. Runtime compatibility with current Jupiter service remains to be verified.
- src/lib/solana-pay.ts: wallet-signed USDC/SOL on-chain transfer construction. A submitted signature alone does not imply final settlement.
- src/lib/wallet.ts and src/lib/use-wallet.ts: browser-local balances and cards are distinct from actual Solana account holdings.

## Markets and trading
- src/lib/sol-house.ts uses PreStocks, Tessera, Jupiter prices and seeded listing fallback. A catalog row is not proof of a fresh executable quote.
- src/lib/world-book.ts uses Jupiter and Ostium feeds; some list URLs still use lite-api.jup.ag, a compatibility and reliability gap.
- src/lib/feeds.ts includes Polymarket, Kalshi, Manifold and discovery fallbacks; distinguish sourced observations from fallback content.
- src/lib/equities.ts queries xStocks and Kamino reserves; not proof Senda directly funds loans.
- src/lib/jup-perps.ts, src/lib/hl-sign.ts, src/lib/ostium-trade.ts, src/lib/lifi.ts and src/lib/lifi-sign.ts provide distinct venue/chain paths subject to their own account and authorization requirements.
- src/lib/print.ts, src/lib/market-quality.mjs, src/lib/solscan-volume.ts and src/lib/liquify.ts: GeckoTerminal candles, research quality rules, indexed activity and Jupiter quote ladders. Historical swap volume is not an order book or executable depth.
- services/liquify/main.go and volume.go: read-only Go service; no custody or swap signing. Solscan Pro ingestion requires server credentials and has limited page coverage.
- docs/OFFERINGS.md records 5,105 entries counted on 2026-10-21; not a verified current executable market count.

## Payments and card truth
- src/components/payments-desk.tsx, src/lib/solana-pay.ts: USDC payments requiring the wallet signature.
- src/components/mexico-send.tsx and src/lib/mxn-rate.ts: Solana USDC transfer and estimated MXN references. No direct SPEI, peso bank payout or Bitso cash-out executed by Senda.
- src/components/cross-send.tsx and src/lib/lifi.ts: cross-chain quotes and source-chain signing require destination-chain finality checks.
- src/lib/card-issuing.ts and src/lib/wallet.ts create locally accounted card-like numbers/cash. Such digits are NOT scheme-cleared Mastercard/Visa payments.
- src/lib/mastercard-oauth.mjs and src/lib/mastercard-vcn.ts contain a separately configured Mastercard Commercial Connect server adapter; not evidence of production issuer onboarding or issued cards.

## Critical local-key and custody risk
- src/lib/pocket-contract.ts, src/lib/cover-chain.ts and src/lib/table-pot.ts create device keypairs and persist secret key material in localStorage. This creates theft, site compromise, storage loss and recovery risks for any funded accounts. Do not describe those as the same safety model as a Phantom-only BYOW transfer. Audit, isolate and harden before encouraging real-money funding.
- src/lib/seal.ts uses wallet-signature-derived AES encryption for selected storage, not a blanket guarantee that every browser local key is encrypted or recoverable.
- src/lib/space.ts stores X25519 private JWKs locally for notes between two wallets. Verify key lifecycle and signature/crypto boundaries.
- chain/senda-program/src/lib.rs records 45-byte cover terms on a PDA: it does not reserve USDC, confirm an oracle trigger or pay claims. The devnet ID recorded in chain/devnet.json is not a mainnet funded cover product.
- src/lib/lend.ts computes 50 percent LTV in localStorage, without an actual funded lender or escrowed collateral. src/lib/option-chain.ts models paper cash-or-nothing contracts. Neither is a funded regulated credit/derivatives product.
- src/lib/senda-program.ts exports an unverified agency-program identifier. Do not imply deployment.

## Agents and intelligence
- src/lib/agent-workspace.ts, src/lib/agent-approval.mjs, src/lib/worker-trade-authorization.mjs and src/components/agent-workspace.tsx: browser-local agent tasks, bounded research, capped queued actions; wallet signs separately.
- src/lib/genesis-runtime.mjs and src/lib/genesis-chain.ts: deterministic Genesis research, optional configured DAS ownership verification; unconfigured assets confer no automatically proven ownership.
- src/lib/utility-ai.ts: evidence-gated PreStocks/GeckoTerminal research and optional server-side OpenAI structured explanation. Default disabled without auth/key configuration; does not sign or execute.
- mcp/server.mjs, mcp/tools.mjs and src/routes/api/agent.ts are read/quote interfaces, not delegated transaction signers. Some Lite Jupiter references remain to inspect.
- scripts/agent-learning-loop.mjs and solana-ecosystem-scout.yml propose evidence and integration candidates, not autonomous deployments or on-chain permissions.

## Infrastructure and release readiness
- React 19, TanStack Start, Vite 8, Tailwind 4. package.json starts dev on port 8080. npm run build includes SSR patch and migrations.
- src/lib/auth/server.ts and middleware.ts implement Better Auth; PGlite is fallback without DATABASE_URL, Postgres/Neon when configured. Auth state and identity are not equivalent to wallet custody.
- vercel.json is a limited install configuration; HANDOFF.md documents a Cloudflare-hosted live desk and says git pushes do not automatically deploy. Verify current production origin and deployment pipeline separately.
- GitHub Actions jobs previously reported runner_id=0 and no executed steps; this static review does not claim green tests.

## Validation commands (not executed)
    npm ci
    npm test
    npm run typecheck
    npm run build:dev
    (cd services/liquify && go test -race ./... && go vet ./...)
    cargo test --manifest-path chain/senda-chain/Cargo.toml
    cargo test --manifest-path chain/senda-program/Cargo.toml
    PYTHONPATH=chain/python python3 -m unittest discover -s chain/python/tests

Independent gates: wallet/browser/mobile QA; stale/wrong-mint quotes; signature replay and unknown confirmation; no-provider card denial; source data integrity and Solscan unit accounting; auth/session isolation; secret-key recovery/exfiltration; cover double-claim; on-chain test and devnet reserve/oracle checks.

## Evidence limits
GitHub repository git checkout failed in the container with DNS resolution error. This audit used GitHub source and tree retrieval, not an executable local clone. No mainnet trade, Go/Rust/Node test suite, browser test, independent security audit or production deployment was completed in this audit.