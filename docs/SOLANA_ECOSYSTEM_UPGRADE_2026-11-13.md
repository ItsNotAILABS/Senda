# Senda — November 2026 Solana Ecosystem Upgrade

Status: **SOURCE IMPLEMENTED / NOT VERIFIED IN PRODUCTION**.

This change preserves Senda's existing Jupiter spot/perps, Phantom signing, LI.FI, Solana Pay, PARRALAX and Liquify V2 paths. It does NOT rewire financial execution or enable unattended agent custody.

## 2026 ecosystem evidence and relevance

| Technology | Official reference | Senda action | State |
| --- | --- | --- | --- |
| Jupiter Swap V2 /order (Metis, JupiterZ, DFlow, OKX) | https://developers.jup.ag/docs/swap/order-and-execute | New authenticated non-taker preview, displayed on existing Routes screen | Source added; no v2 signer |
| Jupiter Tokens V2 /search, /tag, /toptraded, /toptrending | https://developers.jup.ag/docs/tokens | Market tape migrated from Lite hostname to official API; dedicated token inspector | Source added; needs keys/live QA |
| Solana Token-2022 | https://solana.com/docs/tokens/extensions | Read-only RPC program, freeze/mint authority and extension analysis, Mainnet genesis proof | Source added; no new Token2022 transfer builder |
| x402 V2 (CAIP-2, exact) | https://solana.com/docs/payments/agentic-payments/x402 | Pure policy precheck requiring network/mint/recipient/challenge/amount and explicit SDK verification flag | Policy-only; no paid API flow |
| Machine Payments Protocol (MPP) | https://solana.com/docs/payments/agentic-payments/mpp | Policy precheck for charge intent; sessions not silently enabled | Policy-only |
| Solana payment channels | https://solana.com/news/payment-channels-1-million-payments-per-second | Added to bounded ecosystem scout candidates for agent metered spending | Research candidate |
| Solana transaction v1 | https://developers.jup.ag/docs/swap/advanced/transaction-versions | Added to scout for hardware/mobile wallet compatibility evaluation | Research candidate |

## Code changed

- \`src/lib/jup-tape.ts\` — replaces retired Lite host for Tokens V2/Price V3; private API-key support and 0.5 RPS keyless pacing. This is shared process-memory pacing, **not distributed rate limiting**.
- \`src/lib/jupiter-v2-preview.ts\`, \`src/components/jupiter-v2-preview.tsx\` — server-authenticated non-signing Jupiter Swap V2 market preview with no taker, no transaction, no execution.
- \`src/lib/ecosystem-upgrade-core.mjs\` — pure typed-boundary policy functions for quote verification, Solana payment requirements, mint-extension classification and true raw-unit round-trip sell previews.
- \`src/lib/token-safety.ts\`, \`src/components/token-safety-panel.tsx\` — on-chain token-program and token metadata inspector. Checks full mainnet genesis before classifying.
- \`src/lib/jup-exec.ts\` — corrects the previous quote-preview error where an estimated USD sell amount was incorrectly treated as a token's six-decimal raw input. Dollar-budget sells now request a buy quote for raw token quantity, verify mint precision, then quote that raw token back to USDC. **This is a rough round-trip estimate, NOT the user's actual token holdings or final executable sell size**. Existing wallet signing is unchanged.
- \`src/components/jup-ticket.tsx\` — corrected sell preview token-unit display; selected dollar preset now passes to the fill control instead of a hard-coded $25. Still requires wallet review and a fresh execution quote.
- \`src/lib/quote-gate.ts\` — clarifies that an indicative quote is not a filled trade.
- \`config/solana-ecosystem-scout.json\` — adds versioned Solana and Jupiter provider discovery candidates; no auto-install/trades.

## Production sign-off requirements

1. **Jupiter V2:** acquire a server-only \`SENDA_JUPITER_API_KEY\`, validate live price and order response schemas, quote expiration, amount integrity and fee behavior. V2 \`/order + /execute\` with \`taker\` remains a separate wallet-signature integration. Never send model-derived credentials or sign without user permission.
2. **Mint and transaction safety:** configure mainnet \`SENDA_SOLANA_RPC_URL\`, check RPC genesis, program ownership and Token-2022 extensions. Token metadata scores do not certify security. Introduce transaction simulation and explicit instruction reviews for Token-2022 transfer hooks, fees and delegates before adding these assets to generic sends.
3. **x402/MPP:** only an authenticated PARRALAX control plane may set SDK verification and policy-store facts. Add protocol reference SDK, durable tenant-bound budget reservations, atomic replay protection, settled receipt verification and network/asset/recipient allowlists. No agent can freely spend based on this pure policy precheck.
4. **Mainnet trading:** compare UI sell approximations with wallet holdings and final Jupiter quote; verify supported token decimals, RPC availability, and sell direction. No precomputed preview may override signed transaction amounts.
5. **Ops:** run \`npm ci && node --test scripts/ecosystem-upgrade.test.mjs && npm run typecheck && npm test && npm run build:dev\`, with real CI logs. Browser/Phantom mobile QA and negative tests mandatory.
6. **Release:** no live deployment, on-chain execution, trading profits, performance, or verified transaction receipts claimed from the repository changes alone.

## Continuing architecture

Senda remains the **BYOW user experience and transaction signer**. PARRALAX owns reusable research/risk/agent budget and financial backend policy. Vaults or machine-payments rails only become live when deployed, audited, configured and verified. Solana's wallet and program layer is the ultimate fund movement authority.

Do not use this release to claim that Senda is a licensed bank, custodian, token issuer or guaranteed anti-rug service.

## Compatibility sweep and test evidence — November 13, 2026

- src/lib/hold-marks.ts: one Jupiter Tokens V2 batch for up to 24 holding mints, exact mint matching.
- src/lib/chain-tape.ts and src/lib/world-book.ts: official Price V3/Tokens V2 host and private Jupiter API key.
- src/lib/pools/read.ts: retired Lite fallback removed; official research quote endpoint only.
- src/lib/table-pot.ts: read-only SOL price updated. **Device-local stored secret keys remain a high-risk custody design; unmodified.**
- mcp/tools.mjs: read-only MCP Jupiter quote/price endpoint modernization.
- scripts/jupiter-endpoint-regression.test.mjs: guard against retired hosts and sign-capable preview imports.

### Production status
GitHub Actions for Solana ecosystem 2026 upgrade gates returned **failure** after the first workflow run. Job-step summaries were empty and logs inaccessible (404) through the connector, so the root cause could not be attributed to compilation, tests, or runner provisioning. Do not claim a PASS. Cloning the repository in the available runtime also failed due DNS.

Release still requires npm ci, node --test scripts/ecosystem-upgrade.test.mjs scripts/jupiter-endpoint-regression.test.mjs, npm run typecheck, npm test, npm run build:dev, and connected Phantom wallet QA. The sell quote uses a USDC-to-mint-to-USDC round-trip estimate, not the actual connected wallet holding. The signer still uses Jupiter Swap V1; migrate it only through a separately verified approval-gated V2 execution path.
