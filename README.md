# Senda

Hold a tokenized stock on Solana. Borrow against it. Spend without selling it, and without handing a store your bank card.

A brokerage makes you sell the share to get cash. Senda does not. You keep the share, you borrow against the live loan terms, and you pay a store with a number that exists once and is never saved.

This repository is the whole product. A person can read this file and know what it is. An agent can read [AGENTS.md](AGENTS.md) and work in it without being told anything else. The same manual is also stored under the filenames other agents load on their own: `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/senda.mdc`, `.windsurfrules`, `.clinerules`, and `llms.txt`.

## The person

Someone who holds, or wants, a tokenized share (an xStock such as `SPYx` or `TSLAx`) and needs cash today. Selling is the wrong move. A bank card is the wrong instrument. The share should stay theirs. The store should see a card number and nothing else.

## The path

One session, three steps, all on the Portfolio page.

1. **Buy.** A live Jupiter quote for the mint. The button opens Jupiter with that mint. Senda does not pretend it filled the swap itself.
2. **Borrow.** Kamino's public reserve for that mint: max loan-to-value, borrow rate, and how much is already supplied. The button opens the xStocks market on Kamino. Senda does not pretend it signed the borrow.
3. **Pay.** A one-time card number, capped at the amount you chose to borrow, locked to that share's name as the merchant. The number is shown once. It is not written to the wallet, the database, or the server.

The figure at the top of Portfolio is the number that matters: how much you can spend without selling the share you have selected.

## What is real, and what is on this machine

Say this accurately. Do not blur it.

| Piece | Where it actually happens |
| --- | --- |
| Share list, session hours, halted or open | [xStocks public assets](https://api.xstocks.fi/api/v2/public/assets) |
| Max borrow and borrow rate | [Kamino reserve metrics](https://api.kamino.finance) for market `5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua` |
| Buy quote and route | Jupiter lite quote API. The fill is Jupiter's page, not a local fake fill. |
| Borrow | The Kamino market page for that same market id. |
| Cash, currencies, sends, cards | This browser. The ledger is `localStorage`. A new browser starts at zero. |
| Card number | Created here, checked with Luhn, shown once, then dropped. The PAN and CVV are not stored. |
| Books | A replay of that same local journal. If the two sides do not tie, the screen says break. It does not hide the gap. |

Nothing in the app invents a balance, a card, or a bank account the person did not add.

## The rest of the account

The top of every page is the product. The quieter links are the same account, not a second app.

| Page | Path | What it is |
| --- | --- | --- |
| Portfolio | `/` | The share book, the spendable figure, the buy / borrow / pay ticket |
| Pre-IPO | `/pre` | The eight PreStocks. Discount to the SPV mark, the company, a Jupiter buy, a one-day contract |
| Trade | `/invest` | The trading floor: spot, options, perps, index baskets, curves, the PreStocks house |
| Move | `/payments` | Add, send, request, exchange, nearby. A send carries an ISO 20022 UETR. |
| Cards | `/cards` | One-time checkout numbers, including a merchant lock |
| Play | `/social` | Short windows, up to a day, on the same PreStocks names. Settlement uses the live print, not a made-up wheel. |
| Cover | `/cover` | Term cover priced off the same names |
| Solana | `/solana` | The venues around the book: launch, and the accounts you connect |
| Books | `/books` | Internal tokens and the trial balance |
| Account | `/more` | The person, the wallets, the way back into the rest |

Cash is one balance. Trading, sending, and the card all debit it. There is no separate chip stack pretending to be money.

Currencies you can hold: USD, EUR, GBP, MXN, USDC, SOL. Rates for the fiat legs come from a live FX source when the wallet loads. USDC is treated as one dollar.

You can connect Phantom, Solflare, Backpack, MetaMask, Rabby, or Coinbase Wallet from the ticket. Connecting a wallet does not replace the local ledger, and it is not required to mint the one-time number.

## The books

The app keeps its own tokens so the journal can be closed. They are not listed assets. They are the accounting.

- Cash tokens follow the currencies you hold.
- `sSTK` is stock at cost.
- `sGHOST` is the one-time numbers still outstanding.
- `sCAP` is capacity you have reserved.
- `sSUSP` is the plug. If the replay does not match the balances, the difference sits here and `tied` is false.

`digestBooks` in [src/lib/books.ts](src/lib/books.ts) replays every non-failed transaction and returns the trial. Read that function before you invent a new balance.

## How the card works

[src/lib/wallet.ts](src/lib/wallet.ts) issues the number. [src/lib/card-mask.ts](src/lib/card-mask.ts) seals it in the browser with AES-GCM. The seal is so the person can copy it once. The server never receives the PAN. A disposable number is terminated on first use. Do not add a screen that shows a card the person did not just create.

## Layout of the code

```
src/routes/            one file per page
src/components/        the desks those pages render
src/lib/wallet.ts      the ledger, the send, the card issue
src/lib/books.ts       internal tokens and the digest
src/lib/equities.ts    xStocks list and Kamino metrics
src/lib/jup-exec.ts    Jupiter quote and the fill URL
src/lib/wallets.ts     Phantom, Solflare, Backpack, MetaMask, and the others
src/lib/iso20022.ts    pain.001 and the UETR on a send
src/lib/iso8583.ts     the 0100/0110 shape of a card authorization
src/components/app-shell.tsx   the bar across the top
migrations/            Postgres tables. Auth is 0001. The app tables follow.
```

The visual language is in [src/styles.css](src/styles.css): ink `#0c110e`, paper `#f3efe4`, lime `#d4ff4a`. Display type is Newsreader. Body is Instrument Sans. Numbers are IBM Plex Mono. Do not introduce a second palette.

## Run

```bash
npm install
npm run dev
```

The dev server listens on port 8080. `npm run typecheck` must pass. `npm run build` is the production build.

Sign-in is Google or X through the auth already wired under `src/lib/auth`. Do not invent a fake signed-in user. A visitor who has not signed in is signed out. The ledger itself does not require an account. It lives in the browser.

## What not to bring back

This product is not an event, not a venue, and not a ticket site. There is no rooftop and no guest list. If you find copy about any of those, delete it. It is leftover from an empty project that used to live in this folder.

Do not add a balance, a card, or a position the person does not have. An empty account should look empty, with the live market still on the page.
