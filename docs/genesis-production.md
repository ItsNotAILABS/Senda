# Senda Genesis — character runtimes, collectible gear and code modules

This release adds a **working, read-only** character runtime layer at `/agents/genesis`, six original SVG collectible cards (including the previously missing SEN Market Raven card), six gear blueprints, and six code-module blueprints. It also connects a Genesis character to a real Senda local worker. It **does not** mint Solana NFTs or grant the app custody of an account.

## What executes today

`src/lib/genesis-runtime.mjs` contains six deterministic non-signing lanes:

| Character | Runtime | Tool domain |
| --- | --- | --- |
| SEN, the Market Raven | signals | observed trend, pool-volume acceleration, source quality |
| NEX, the Strategy Fox | strategies | explicit rule hypotheses and validation warnings |
| KAI, the Guardian Owl | risk | volatility, risk constraints and incomplete data |
| ZENO, the Market Dragon | macro | bounded market structure, no fabricated macro correlations |
| ORBI, the AI Companion | orchestrator | mission planning, approval and error checkpoints |
| LYRA, the Creative Spirit | creator | data-grounded creator/editor briefs |

Agents can be installed into Senda's `Worker` store and run again from the Agent Studio. Their Genesis bindings are local descriptive state, never secret keys or transferable NFTs.

Character / gear / code ownership is verified by the **server-only** `readGenesisOwnership` handler against an explicit registry and a Solana DAS provider. Verification requires an exact owner, exact registered asset ID, and the expected collection. If the server is unconfigured, the app correctly shows `Blueprint / Unminted`; a user may still preview the base runtime, but no gear or code features unlock. Browser storage cannot create ownership or premium privileges. This is a public owner lookup, **not signed-wallet authentication** for high-value services.

### Required server configuration for an authorized NFT launch

- `SENDA_GENESIS_DAS_RPC_URL`: HTTPS DAS JSON-RPC provider supporting `getAsset`; server secret, never embed in browser.
- `SENDA_GENESIS_COLLECTION`: deployed, verified Solana collection address.
- `SENDA_GENESIS_ASSETS_JSON`: explicit mapping of the 18 asset blueprint IDs to their actual minted address/asset IDs, for example `{"sen":"<mint-address>","raven-wing":"<mint-address>"}`.

Keep **all three** unset until the collection, mint authority, immutable metadata, ownership and supply policies exist. Never populate them with guessed or pretend addresses. `getAsset` data must expose ownership and collection grouping; unsupported provider formats fail closed.

### Mint release sequence (not executed)

1. Have legal/compliance review the collectibles, marketing claims, resale/royalty policies, trademark rights and regional eligibility.
2. Run `npm run genesis:metadata`; inspect `public/genesis/metadata/manifest.json` and the 18 records. All records have `status: unminted-blueprint` and no fake mint address.
3. Render and audit image compatibility: source SVG artwork is usable in Senda; many external NFT marketplaces require PNG/JPEG and content-addressed storage.
4. Upload artwork and metadata to immutable/content-addressed storage, verify SHA-256 content hashes, and pin retention commitments.
5. With an authorized organization treasury and a reviewed Metaplex Core/Token Metadata deployment, create the collection and mint exact, deliberate supply. Use a wallet-signing procedure and produce independently verified transaction receipts. No automated mint path exists in this PR.
6. Configure the DAS server secret and registry only with **confirmed actual asset IDs**. Test holdings, transfer, resale, burn, wrong owner and collection spoof cases before allowing paywalled capabilities.
7. For valuable online privileges, add signed-wallet challenge authentication, a durable entitlement service, ownership revocation/transfer subscriptions, rate limits and replay protection. Do not use browser-local equipment state as a security boundary.

## Equipment safety and product economy

- Each character has a matching gear and a matching versioned code pack. Code packs enable **compiled, allowlisted research lenses**; arbitrary executable JavaScript from NFT metadata is never loaded or evaluated.
- NFT ownership does not change spend limits, confer a profitable strategy or authorize a transaction. All wallet actions remain explicitly human-approved under the existing routing and confirmation systems.
- Collectibles can later form a marketplace, upgrade recipes, agent identities, tournament badges, quests, and creator modules, but any on-chain financial or earned reward feature requires separate code and verification. No speculative benefits are asserted as live.
- Local worker logs and selected loadouts live in one browser. They are not token inventory or a settlement ledger.

## Validation

```sh
npm run genesis:test
npm run genesis:metadata
npm run typecheck
npm run build:dev
```

The tests verify six distinct identities, 18 unique assets, the Market Raven metadata path, six read-only runtime outputs, reliable source/volume exclusions, wrong-owner and collection spoof rejection, and loss of module entitlement after transfer. Complete browser-wallet E2E and full application compilation remain separate release gates.
