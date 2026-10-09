# Senda — read this before you edit anything

You are working in the Senda repository. This file is the manual. The same text is copied to `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`, and `llms.txt`. Trust the code when it disagrees with a memory from another project.

The module map is [docs/MODULES.md](docs/MODULES.md). The agent interface is [mcp/server.mjs](mcp/server.mjs).

## What Senda is

Senda is the desk for tokenized pre-IPO names that already trade on Solana. The wallet the person connects is the account. A buy is a Jupiter route they sign. A holding is the token balance in that wallet, marked at the live print. A payment is a USDC transfer they sign.

It is not a broker, not a bank, and not a card network. It is not an event site. Do not add a venue, a rooftop, tickets, an RSVP, speakers, or a guest list. That project was removed.

A PreStock is economic exposure. Not a legal share, not a vote, not a dividend. Do not write copy that says the person owns the company.

## What is real

- Prints come from `https://prestocks.com/api/prestocks`, loaded in `src/lib/sol-house.ts`.
- Trade candles are the pool, from GeckoTerminal, in `src/lib/print.ts`. If that feed is busy, the last price still stands. Do not draw a fake series.
- A buy, sell, or convert is quoted on Jupiter, simulated, then signed. `src/lib/jup-sign.ts` and `src/lib/prestock.ts`. The wallet signs. Senda does not invent a fill.
- Portfolio and the wallet strip call `readChain` in `src/lib/phantom.ts`. Empty means the wallet holds none.
- Pay is an SPL transfer of USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) plus a memo. `src/lib/solana-pay.ts`. `usdcPayLink` builds a Solana Pay URL. It does not send the money.
- Cover premium is 4% of the size. It pays if the print is 10% under the price that was locked. The person signs the USDC. `src/lib/cover-chain.ts`. It is not a licensed policy. The token stays in the wallet.
- Work posts a job in this browser and pays it by a USDC transfer to the worker address. `src/lib/work-jobs.ts`.
- Senda cash, practice play, the sheet, the agent log, listings, and the desk-number last four live in this browser. A fresh browser is at zero. Never seed a balance, a card, or a position.
- The desk number is issued by `issueCheckout`. The full number is shown once and is not a BIN. A terminal will decline it.
- An agent inside the app can read the book and queue a trade. It cannot sign. `src/components/agents-desk.tsx`.
- An agent outside the app uses `node mcp/server.mjs`. Same rule. It can quote and read. It cannot sign.

## Chains

- Mainnet buys, sells, and USDC payments. Jupiter and SPL. There is no Senda program on mainnet. Do not invent one.
- Devnet cover program `4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta`, recorded in `chain/devnet.json`. It does not hold the PreStock.
- Rust payment builder: `chain/senda-chain`. Python twin: `chain/python`. The tests lock the same bytes.
- Solana wallets sign PreStocks, cover, work, and USDC. Ethereum wallets are a different signature. Do not route a PreStock buy through MetaMask.

## The pages

Defined in `src/components/app-shell.tsx`.

- `/` Home. The line, the book, a buy, the wallet strip.
- `/pre` PreStocks.
- `/wallet` Convert.
- `/wallets` Which wallet does which job. Robinhood buying power into USDC on the Solana address.
- `/social` Play. Practice cash is separate.
- `/cards` Shop. A desk number, and Pay USDC.
- `/make` Listings other people pay for in USDC.
- `/agents` The agent workspace. A cap. A queue. The person signs.
- `/payments` Send.
- `/vault` Portfolio.
- `/cover` The 10% line.
- `/work` The sheet and the job board.
- `/invest` Trade. The live names, pool candles, a Jupiter quote, then sign.
- `/equities` Listed shares. xStocks, and what Kamino will lend against them.
- `/solana` The mints.
- `/books` The ledger already stored on this account.
- `/docs` The written desk.
- `/more` Account.

## MCP

Tools, all read or build, none of them sign:

| Tool | Does |
| --- | --- |
| `desk_map` | The pages. |
| `rules` | What not to fake. |
| `list_prints` | Live PreStock prints. |
| `quote_swap` | A Jupiter quote for a mint and a dollar size. |
| `read_wallet` | SOL and tokens for a public address. |
| `usdc_pay_link` | A `solana:` payment URL. |
| `cover_terms` | Premium and the 10% line. |

`.mcp.json` points a client at `node mcp/server.mjs`. The frame is Content-Length. `node --test mcp/tools.test.mjs` covers the pure tools.

## Stack

React 19, TypeScript, Vite, TanStack Start and Router. Tailwind v4 tokens are in `src/styles.css`. Auth is optional and is not the wallet.

## Commands

```bash
npm install
npm run dev
npm run typecheck
node --test mcp/tools.test.mjs
node mcp/server.mjs
```

The desk is on port 8080. Do not move it. Do not commit `.env`, secrets, `node_modules`, or chat attachments. Do not store a PAN, a CVV, or a seed.

## A change is done when

- A buy still asks the wallet to sign a Jupiter route.
- No balance, card, or position appears that the person did not create.
- The event site is still gone.
- The MCP still cannot sign.
- `npm run typecheck` passes.
