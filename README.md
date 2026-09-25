<p align="center">
  <img src="public/banner.jpg" alt="Senda. Pre-IPO on Solana." width="100%">
</p>

<p align="center">
  <a href="https://img.shields.io/badge/Solana-pre--IPO-14151c?style=flat-square&logo=solana&logoColor=14F195"><img src="https://img.shields.io/badge/Solana-pre--IPO-14151c?style=flat-square&logo=solana&logoColor=14F195" alt="Solana"></a>
  <a href="https://img.shields.io/badge/custody-your%20wallet%20signs-c6f135?style=flat-square&labelColor=111111"><img src="https://img.shields.io/badge/custody-your%20wallet%20signs-c6f135?style=flat-square&labelColor=111111" alt="Your wallet signs"></a>
  <a href="https://img.shields.io/badge/routes-Jupiter-14151c?style=flat-square"><img src="https://img.shields.io/badge/routes-Jupiter-14151c?style=flat-square" alt="Jupiter routes"></a>
  <a href="https://img.shields.io/badge/pay-USDC%20on%20mainnet-14151c?style=flat-square"><img src="https://img.shields.io/badge/pay-USDC%20on%20mainnet-14151c?style=flat-square" alt="Pay USDC on mainnet"></a>
  <a href="https://github.com/ItsNotAILABS/Senda/commits/main"><img src="https://img.shields.io/github/last-commit/ItsNotAILABS/Senda?style=flat-square&color=14151c" alt="Last commit"></a>
</p>

<h1 align="center">The desk for pre-IPO names that already trade.</h1>

<p align="center">
  Your wallet is the account. Jupiter quotes the route. You sign.<br>
  A payment is USDC to their address. The print does not close at four.
</p>

<p align="center">
  <a href="public/video/desk.mp4"><img src="public/cover.jpg" width="49%" alt="Play the desk film"></a>
  <a href="public/video/card.mp4"><img src="public/images/metal-card.jpg" width="49%" alt="Play the card film"></a>
</p>

<p align="center"><sub>The stills are the films. Click either one.</sub></p>

---

Senda is the operating layer on top of tokenized pre-IPO names on Solana. Buy one. Hold it in the wallet you already have. Cover a drop. Pay a merchant in USDC. Play the live print. Hand an agent a bound, and keep the signature for yourself.

A brokerage cannot see the mint, and it is closed at midnight. A raw swap page can fill a route and then leaves you there. Senda is the desk in between.

<p align="center">
  <img src="public/felt.jpg" width="100%" alt="Ten games on the live print.">
</p>

## What you can do tonight

| | | |
| --- | --- | --- |
| **Buy** | A Jupiter quote into the mint. Simulated first. Signed in your wallet. | PreStocks |
| **Hold** | Portfolio is the token account, marked at the last print. Empty until the chain says otherwise. | Portfolio |
| **Convert** | SOL or USDC in, the name out. Or the slice back. One route, one signature. | Convert |
| **Cover** | Ten percent under the print you lock. Premium in USDC, you sign. The token stays put. Not a policy. | Cover |
| **Play** | Ten games settled off the live book. Practice cash never touches the wallet. | Play |
| **Pay** | USDC to a Solana address. The merchant's token account receives it. | Shop |
| **Spend** | A desk number, shown once, that only debits cash in this browser. A terminal will decline it. | Shop |
| **Arm** | An agent that can queue and cannot sign. The shift stops when you close the tab. | Agents |

## Two ways to pay

A store on the card networks and a merchant on Solana are not the same door.

**Pay in USDC.** Shop takes a Solana address and an amount. Senda builds a mainnet transaction: your USDC token account, theirs, a memo with a Solana Pay reference. Your wallet signs. If they have no USDC account yet, the same transaction creates it and you pay the rent. The signature is the receipt. [solscan.io](https://solscan.io) will show it. There is no BIN, no issuer, and no second balance. The mint is USDC, `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. The code is [src/lib/solana-pay.ts](src/lib/solana-pay.ts).

**A number on the desk.** Make one, see it once, keep the last four and the cap. A charge debits Senda cash in this browser. Visa never sees it, so a checkout will decline it. That number is a cap and a record. It is not a card. The Mastercard mark is not on it.

**A swipe a terminal will clear** needs an issuer. These already spend Solana dollars. None of them can be minted from this repo, because each one is someone else's program and someone else's KYC.

| Card | What it spends | Who holds the dollars | What the store sees |
| --- | --- | --- | --- |
| Phantom Cash | Bridge's CASH on Solana | Your Phantom balance until the swipe | Lead Bank debit. Apple Pay, Google Pay. |
| Jupiter | USDC | The Jupiter card balance | Visa, through Rain or DCS. |
| KAST | USDC, USDT, or PYUSD deposited on Solana | KAST. Custodial. | Visa, including a Solana physical card. |
| Solflare | USDC from the wallet | Was the wallet | Paused 28 Jul 2026. Kulipa, the issuer, wound down. |

The pipes under the live Visa cards are **Rain** and **Bridge**. Both will issue a branded card for a program. Both require that program, a bank sponsor, and KYC. Cloning their logo does not create a BIN. When Senda has a program, the same Shop button can sit on that issuer. Until then the chain path is the USDC transfer, and the desk number stays labeled as a desk number.

## Why it belongs on Solana

The name is already a mint. The route is already on Jupiter. The key is already in Phantom, Solflare, or Backpack. A payment is already a token transfer. Senda does not take custody to make any of that true. If the wallet is not in the browser, it is not offered. If the quote fails, nothing is invented. If the USDC account is empty, the transfer is not built.

## What is on the chain

Cluster is **mainnet-beta**. There is no Senda program. There is nothing to deploy, and no program id to pretend. The chain work is transactions the user's wallet signs.

| Action | What is signed | Where |
| --- | --- | --- |
| Buy, sell, convert | Jupiter swap. Simulated, then signed. | [src/lib/jup-sign.ts](src/lib/jup-sign.ts) |
| Pay | SPL token transfer of USDC, plus a memo | [src/lib/solana-pay.ts](src/lib/solana-pay.ts) |
| Cover premium | USDC into a cover account whose key stays in the browser, plus a memo of the terms | [src/lib/cover-chain.ts](src/lib/cover-chain.ts) |
| Portfolio | Read of token accounts. Nothing is signed. | the wallet |

Constants a reviewer can check:

- USDC mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, 6 decimals
- Token program `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- Associated token program `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`
- Memo program `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
- Jupiter quote `https://lite-api.jup.ag/swap/v1/quote`, with the keyed API as a fallback
- RPC `https://api.mainnet-beta.solana.com`, then `https://solana-rpc.publicnode.com`
- Wallets: whatever Solana injector is actually in the window. Phantom, Solflare, Backpack, and the others in [src/lib/wallets.ts](src/lib/wallets.ts). A missing extension is not drawn as connected.

The browser ledger is Senda cash, practice play, the sheet, the agent log, and the desk-number last-four. It is not a chain balance. Clearing the site clears it.

## What is live

- Prints from the public pre-IPO book.
- A Jupiter quote, a simulation, and a signature.
- Holdings read back from token accounts.
- A USDC payment to an address you paste.
- Practice play and real play, on two different balances.
- A cover whose premium is a USDC transaction.
- A desk number and a charge against browser cash.
- An agent envelope with a spend cap. It queues. It does not sign.

Not built, and not dressed up as built: a Senda program, a brokerage account, margin, a bank wire, a Visa or Mastercard BIN, Apple Pay, an agent key, a shift that runs after the tab closes.

## Run

```bash
npm install
npm run dev
```

The desk is on port 8080. `npm run typecheck` has to pass. No env var is required to read the book or to ask a wallet to sign. A Jupiter API key is optional. The public RPC is the default, and it rate-limits. Point a private RPC at the same calls in [src/lib/phantom.ts](src/lib/phantom.ts) when you need a higher limit.

Open the book. Load practice cash and play a print. Connect a wallet and quote the same name. On Shop, paste an address and sign a dollar of USDC. The three moments use the same wallet.

## For the people building on it

[AGENTS.md](AGENTS.md) is the manual. The same file is also `CLAUDE.md`, `GEMINI.md`, `llms.txt`, and the instruction files Cursor, Copilot, Windsurf, and Cline load on their own. Do not invent a balance, a card, or a position the wallet does not have. Do not add a program id that was not deployed.

The long note is [public/senda-submission.md](public/senda-submission.md). The PDF is [public/senda-submission.pdf](public/senda-submission.pdf).

<p align="center">
  <img src="public/og.jpg" width="720" alt="Senda">
</p>

<p align="center"><sub>ItsNotAILABS · original work · <a href="https://github.com/ItsNotAILABS/Senda">github.com/ItsNotAILABS/Senda</a></sub></p>
