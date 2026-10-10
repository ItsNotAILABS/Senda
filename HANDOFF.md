# Handoff

Stop here. The desk is usable. The next change should be a real gap, not a rewrite of a page that already works.

## Where it lives

| | |
| --- | --- |
| Live | [https://senda.pocketnova.app](https://senda.pocketnova.app) |
| Source | [https://github.com/ItsNotAILABS/Senda](https://github.com/ItsNotAILABS/Senda) |
| Manual | [AGENTS.md](AGENTS.md) |
| Map | [docs/MODULES.md](docs/MODULES.md) |

The GitHub homepage is the live desk. This repo is what that desk is built from.

## What a person can do

Connect a wallet they already have. Buy a PreStock. Jupiter quotes it. They sign. The mint stays in that wallet.

From the same account they can convert, cover a 10% drop, send USDC, post work, list something on Make, play the print with practice cash, or hand an agent a job that cannot sign.

Trade opens on the live names. The chart is pool candles for the name they pick (`src/lib/print.ts`). Listed is the xStocks book and the Kamino line on a share (`/equities`). Solana also shows Jupiter prices for more Solana markets and DefiLlama spot prices for other chains. Those rows are prices. A chain row is not a buy.

## What is not true

- There is no Senda program on mainnet. Do not add one.
- The devnet cover program is `4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta`. It does not hold the PreStock.
- A PreStock is a price, not a share, a vote, or a dividend.
- The desk number is not a card a terminal will clear.
- Browser cash, practice play, the sheet, and the agent log are not a chain balance. A fresh browser is at zero.
- An agent can ask. It cannot sign.

## If you continue

1. Read [AGENTS.md](AGENTS.md) before editing.
2. Keep the rail. Add to a desk. Do not replace it.
3. A chart with no pool candles stays empty. The last price is enough.
4. `npm run typecheck` has to pass.
5. Do not commit secrets, a PAN, a CVV, or a seed.

## Run

```bash
npm install
npm run dev
```

The desk is on port 8080.
