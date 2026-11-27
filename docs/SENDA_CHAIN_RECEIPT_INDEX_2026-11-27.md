# Senda Money - optional durable public chain receipt index

**Source stage:** database-backed, tested, off by default. No user balances, transaction signing, or agent spending are added.

## Activation prerequisites
- A persistent Postgres `DATABASE_URL` with migration `0011_wallet_chain_receipt.sql` applied.
- Set server-only `SENDA_ACTIVITY_INDEX_ENABLED=true`. Without both prerequisites, no persistent receipt writes or reads occur.
- Keep a dedicated rate-limited provider endpoint and service observability. Existing in-process read limits are **not** durable distributed quotas.
- Use verified session sign-in for querying indexed history. This proves only a Senda login session, **not** ownership of the queried public wallet. Do not store private labels or metadata under that assumption.

## Financial truth
The current `getWalletActivity` handler fetches Solana mainnet wallet/canonical-USDC-ATA signatures and obtains exact RPC confirmation statuses. Only that backend's chain-source rows are passed to `indexChainReceiptsFromRpc`. The storage reducer accepts **confirmed, finalized, failed** results from `source: solana-rpc`, and rejects pending, local recovery, malformed amounts, mixed wallet owners, and conflicting status events. Finality upgrades are monotonic; failures never become success.

Receipt history consists of network, owner, signature, chain slot/time, status, optional exact USDC balance delta, and verification timestamps. It is **not** a bank ledger, fee ledger, proof of a particular recipient, or proof of insured funds. In case of an RPC outage the existing chain reader fails closed; indexed historical evidence may be read separately with its prior verification time, never recast as real-time finality.

The `getIndexedChainReceipts` server function returns only public chain data, and requires a verified Senda session. A separate wallet-signed, replay-resistant ownership challenge is required before adding private labels, user-specific transaction notes, user/agent account mappings, or authenticated cross-device private history. Such private storage is **not** implemented here.

## Verification
- `node --test scripts/wallet-chain-receipt-index.test.mjs` (PGlite-backed SQL regression suite)
- `npm run build:dev`
- `npm run typecheck` (compare with existing baseline, not only exit code)

**Status as of 2026-11-27:** 5/5 PGlite tests passed and the development build passed. TypeScript still reports the same 147 pre-existing errors as main after route generation. No production DATABASE_URL, authenticated wallet-owner binding, durable distributed quota, or production migration execution was verified. Enable only after infrastructure and load tests.
