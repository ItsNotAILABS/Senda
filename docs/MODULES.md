# Senda modules

The desk is one app. Files stay where the imports already point. This is the map, so a change lands in the right place.

The wallet signs. Senda does not hold the key, the token, or a balance the chain did not return.

## Shell

| Path | Role |
| --- | --- |
| `src/components/app-shell.tsx` | The rail. Home, PreStocks, Convert, Wallets, Play, Shop, Make, AI Agent, Send, Portfolio, then Cover, Work, Trade, Solana, Books, Docs, Account. |
| `src/components/money-bar.tsx` | SOL, USDC, and other token counts for the connected Solana address. Read only. |
| `src/routes/` | One file per page. `/wallets` is `src/routes/wallets.tsx`. |

## Book

| Path | Role |
| --- | --- |
| `src/lib/sol-house.ts` | Live prints. PreStocks at `https://prestocks.com/api/prestocks`. Tessera beside it. Jupiter price as a second look. |
| `src/lib/prestock.ts` | Buy or sell a name. Quote, simulate, then the wallet signs. |
| `src/lib/jup-exec.ts` | Jupiter quote. |
| `src/lib/jup-sign.ts` | The swap transaction the wallet signs. |
| `src/components/pre-desk.tsx` | The PreStocks page. |
| `src/components/jup-ticket.tsx` | The spot list under Trade. |

## Wallets

| Path | Role |
| --- | --- |
| `src/lib/wallets.ts` | Only wallets injected in this browser. Phantom, Solflare, Backpack, Glow, OKX, Bitget, Trust, Coinbase on Solana. MetaMask, Rabby, Coinbase, Brave on Ethereum. |
| `src/lib/phantom.ts` | Connect, simulate, send, and `readChain` for a Solana address. |
| `src/lib/wallet-context.tsx` | Addresses the person linked. Not a custody account. |
| `src/lib/robinhood.ts` | Opens Robinhood Connect so buying power can land as USDC on that Solana address. |
| `src/components/wallets-desk.tsx` | The Wallets page. |

Solana signs a PreStock, a cover, a job, and a USDC payment. Ethereum is a different signature. Do not send a PreStock buy to MetaMask.

## Money movement

| Path | Role |
| --- | --- |
| `src/lib/solana-pay.ts` | USDC transfer on mainnet, plus `usdcPayLink`. Mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. |
| `src/lib/clearing.ts` | A local note of a signature the wallet already made. Not a second ledger of record. |
| `src/components/clear-strip.tsx` | Shows those notes on Work, Cover, and Send. |
| `src/components/payments-desk.tsx` | Send, on-chain USDC, request, nearby, exchange, add. |
| `src/lib/space.ts` | A sealed note between two addresses. The server must not be able to read it. |

## Cover

| Path | Role |
| --- | --- |
| `src/lib/cover-chain.ts` | Premium is a USDC transfer the person signs. Terms ride the memo. |
| `src/components/cover-desk.tsx` | Size, the 10% line, the premium at 4%. |
| `chain/devnet.json` | Devnet program `4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta`. |
| `chain/senda-program` | The on-chain cover program. |
| `chain/senda-chain` | Rust builder for the USDC transfer and the cover memo. |
| `chain/python` | The same payment and the same print, in Python. Tests lock the bytes to the Rust crate. |

There is no Senda program on mainnet. Buys and payments there are Jupiter and SPL.

## Work and Make

| Path | Role |
| --- | --- |
| `src/lib/work-jobs.ts` | A job: title, USDC, worker address. Stored in this browser until it is paid. |
| `src/components/work-jobs.tsx` | Post, pay, or copy a Solana Pay link. Pay asks the wallet to send USDC. |
| `src/components/work-desk.tsx` | The live sheet next to that board. |
| `src/lib/make-board.ts` | Listings. The price is USDC to the address on the listing. |
| `src/components/make-desk.tsx` | The Make page. |

## Trade

| Path | Role |
| --- | --- |
| `src/components/pit-floor.tsx` | The ticket. Size, side, a Jupiter quote, then sign. |
| `src/lib/option-chain.ts` | Calls and puts on a print. A put premium uses the cover path. |
| `src/components/perp-desk.tsx` | Levered long or short against the book. |
| `src/components/lend-desk.tsx` | Cash against a holding. The token stays. |
| `src/lib/house-paper.ts` | Paper marks for practice. Not a chain balance. |

## Play, agents, shop

| Path | Role |
| --- | --- |
| `src/components/social-desk.tsx` | Play. Practice cash stays off the wallet. |
| `src/lib/play.ts` | The games. |
| `src/lib/agent-envelope.ts` | An agent with a cap and a side. |
| `src/components/agents-desk.tsx` | Make one. The queue waits. The person signs. |
| `src/lib/wallet.ts` | Browser cash, the desk number, contacts. A fresh browser is at zero. |
| `src/components/cards-desk.tsx` | The number, shown once. Not a BIN. |
| `src/lib/card-mask.ts` | Last four and the cap. Do not store a PAN or a CVV. |

## Agents outside the app

`mcp/server.mjs` is the MCP. It can list prints, quote Jupiter, read a public address, build a pay link, and price a cover. It cannot sign.

Turn it on with `node mcp/server.mjs`, or with `.mcp.json` for a client that reads that file.

`AGENTS.md` is the manual. The same text is `CLAUDE.md`, `GEMINI.md`, `llms.txt`, `.clinerules`, `.windsurfrules`, and `.github/copilot-instructions.md`.
