# Senda — read this before you edit anything

You are working in the Senda repository. This file is the manual. The same text is copied to `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/senda.mdc`, `.windsurfrules`, `.clinerules`, and `llms.txt`. Trust the code when it disagrees with a memory from another project.

## What Senda is

Senda is a desk for tokenized pre-IPO names that already trade on Solana. The wallet the person connects is the account. A buy is a Jupiter route they sign. A holding is the token balance in that wallet, marked at the live print. A payment is a USDC transfer they sign. There is no Senda program and no program id.

It is not a broker, not a bank, and not a card network. It is not an event site. Do not add a venue, a rooftop, tickets, an RSVP, speakers, or a guest list. That project was removed.

## What is real

- Prints come from `https://prestocks.com/api/prestocks`, loaded in `src/lib/sol-house.ts`.
- A buy, sell, or convert is quoted on Jupiter, simulated, then signed. `src/lib/jup-sign.ts` and `src/lib/prestock.ts`. The wallet signs. Senda does not invent a fill.
- Portfolio reads token accounts. Empty means the wallet holds none.
- Pay is an SPL transfer of USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) plus a memo. `src/lib/solana-pay.ts`.
- Cover premium is a USDC transfer the user signs. `src/lib/cover-chain.ts`. It is not a licensed policy.
- Senda cash, practice play, the sheet, the agent log, listings, and the desk-number last four live in this browser. A fresh browser is at zero. Never seed a balance, a card, or a position.
- The desk number is issued by `issueCheckout`. The full number is shown once and is not a BIN. A terminal will decline it.
- An agent lives in `src/components/agent-floor.tsx` on `/agents`. It reads the live book, remembers the last look in this browser, quotes Jupiter, and queues a buy or a sell from $1. It cannot sign. Do not put the old envelope form back on this route.

## The pages

The left rail is `NAV` in `src/components/app-shell.tsx`. These are the product. Do not drop one because another file exists.

| Route | Rail | Desk | What it is |
| --- | --- | --- | --- |
| `/` | Home | `home-desk.tsx` | The line, the book, a buy, the card. |
| `/pre` | PreStocks | `pre-desk.tsx` | The name, the chart, the ticket. A buy is Jupiter. |
| `/wallet` | Convert | `wallet-desk.tsx` | SOL, USDC, and a PreStock. Phantom is a source, not a login. |
| `/social` | Play | `play-floor.tsx` | Games on the live print. Practice cash is not the wallet. |
| `/cards` | Shop | `cards-desk.tsx` | A desk number for a store, and pay in USDC. |
| `/make` | Make | `make-desk.tsx` | Listings. Other people pay in USDC. |
| `/agents` | AI Agent | `agent-floor.tsx` | A session. Name, job, size from $1. It can make another agent. You sign. |
| `/payments` | Send | `payments-desk.tsx` | Send, nearby, request, exchange, add. |
| `/vault` | Portfolio | `vault-desk.tsx` | What the wallet holds, marked at the print. |
| `/cover` | Cover | `cover-desk.tsx` | A USDC premium the user signs. Not a licensed policy. |
| `/work` | Work | `work-desk.tsx` | The sheet, in the same cards. |
| `/invest` | Trade | `pit-floor.tsx` | The ticket. Chips set a size. They do not send. |
| `/solana` | Solana | `solana-floor.tsx` | The chain path: wallet, Jupiter, USDC, the program that is not ours. |
| `/books` | Books | `books-desk.tsx` | The books the desk reads. |
| `/docs` | Docs | `docs-desk.tsx` | Use, build, infra, security, research. |
| `/more` | Account | `more-desk.tsx` | The person, the wallet, the legal page. |

Off the rail, still in the app: `/cage`, `/lab`, `/market`, `/accounts`, `/equities`, `/legal`, `/login`, `/house/$id`, `/table/$id`. Do not promote them onto the rail unless asked.

## Working rules

- The wallet signs. Senda does not hold the mint, the USDC, or a seed.
- Prints: `https://prestocks.com/api/prestocks` in `src/lib/sol-house.ts`. xAI is off the book.
- Quote then sign: `src/lib/jup-exec.ts`, `src/lib/jup-sign.ts`, `src/lib/prestock.ts`.
- Pay: SPL USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` plus a memo. `src/lib/solana-pay.ts`.
- A fresh browser is at zero. Never paint a card, a balance, or a position the person did not make.
- Do not put back the event site, Stocklana, or Vice Park.
- Do not replace a page the person already uses with an older one. Add, or change the part they named.

## Stack

React 19, TypeScript, Vite, TanStack Start and Router. Tailwind v4 tokens are in `src/styles.css`. Auth is optional and is not the wallet.

## Commands

```bash
npm install
npm run dev
npm run typecheck
```

The desk is on port 8080. Do not move it. Do not commit `.env`, secrets, `node_modules`, or chat attachments. Do not store a PAN, a CVV, or a seed.

## A change is done when

- A buy still asks the wallet to sign a Jupiter route.
- No balance, card, or position appears that the person did not create.
- The event site is still gone.
- `npm run typecheck` passes.
