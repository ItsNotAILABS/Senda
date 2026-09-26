<p align="center">
  <img src="public/banner.jpg" alt="Senda" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/devnet-4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta-111111?style=flat-square&labelColor=14F195&color=111111" alt="Devnet program">
  <img src="https://img.shields.io/badge/wallet-you%20sign-c6f135?style=flat-square&labelColor=111111" alt="You sign">
  <img src="https://img.shields.io/badge/route-Jupiter-111111?style=flat-square" alt="Jupiter">
  <img src="https://img.shields.io/badge/pay-USDC-111111?style=flat-square" alt="USDC">
  <img src="https://img.shields.io/github/last-commit/ItsNotAILABS/Senda?style=flat-square&color=111111" alt="Last commit">
</p>

<h1 align="center">Your pre-IPO shouldn’t sit still after you buy it.</h1>

<p align="center">
  Senda is the desk for tokenized pre-IPO names on Solana.<br>
  The wallet you already have is the account. Jupiter quotes the route. You sign.<br>
  A payment is USDC to their address. The print does not close at four.
</p>

<p align="center">
  <a href="public/video/desk.mp4"><img src="public/cover.jpg" width="49%" alt="The desk"></a>
  <a href="public/video/card.mp4"><img src="public/images/metal-card.jpg" width="49%" alt="The card"></a>
</p>

---

A brokerage cannot see the mint, and it is closed at midnight. A swap page can fill a route and then leaves you there. Senda is the layer in between: buy the name, hold it in your wallet, cover a drop, pay someone in USDC, play the print, or hand an agent a job it cannot sign.

There is no mainnet Senda program. Buys are a Jupiter swap the wallet signs.

## Devnet

The cover program is deployed.

| | |
| --- | --- |
| Cluster | devnet |
| Program | [`4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta`](https://explorer.solana.com/address/4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta?cluster=devnet) |
| Deploy | [`2erKJos87WTkYxyA1QFJvZNUjHeL2m15wE6kUSu2bk2G1upUV9yfZw6ykacmLEP3oUc3K8AgHQddgapjvVBqRMay`](https://explorer.solana.com/tx/2erKJos87WTkYxyA1QFJvZNUjHeL2m15wE6kUSu2bk2G1upUV9yfZw6ykacmLEP3oUc3K8AgHQddgapjvVBqRMay?cluster=devnet) |
| Ref | [chain/devnet.json](chain/devnet.json) |

The wallet signs. The program writes the cover account. It does not hold the PreStock.

## After the buy

The token stays in the wallet. Half the print can be drawn as cash. Spending that cash does not sell the name, and the name is what you still owe against. Listed shares that Kamino already lends on stay on that market. A PreStock uses this loan, because that mint is not in the xStocks market.

## The lane

A holder gets the price, not the company. No legal share, no vote, no dividend. OpenAI and Anthropic have voided unauthorized SPV transfers. Those prints fell 34–40%, and the book on the chain is thin next to the valuation on the wrapper.

Minting, redemption, and most of the issuer interfaces block a U.S. address or ask for a non-U.S. declaration. Solana does not. A U.S. person can still buy on Jupiter, then sits in the Regulation S resale window, forty days or a year, and carries the risk that the marketing is later called a U.S. offer. Forge and EquityZen remain the compliant route for American retail and institutions. The September 2026 Innovation Exemption does not cover these wrappers. It is for already-listed stocks that come with votes and dividends and that trade on a permissioned U.S. venue. Pre-IPO tokens stay offshore.

## Tonight

| | What happens | Where |
| --- | --- | --- |
| **Buy** | Jupiter quotes USDC into the mint. Simulated, then signed. The token lands in the wallet that signed. | PreStocks |
| **Hold** | Portfolio is the token account, marked at the last print. Empty until the chain says otherwise. | Portfolio |
| **Convert** | SOL or USDC in, the name out. Or the slice back. One route. | Convert |
| **Cover** | Ten percent under the print you lock. The premium is a USDC transfer you sign. The token stays. Not a policy. | Cover |
| **Play** | Ten games. The result is the live print. Practice cash never touches the wallet. | Play |
| **Pay** | USDC to a Solana address. Their token account receives it. | Shop |
| **Number** | Shown once. Caps cash in this browser. A card terminal will decline it. It is not a BIN. | Shop |
| **Agent** | You write what it is for. It can read the book and queue a trade. You still sign. | Agents |
| **Make** | Post a job, software, a service, hardware, or what a class needs. The price is USDC. The whole amount goes to their address. | Make |

## Pay

A store on a card network and a merchant on Solana are not the same door.

**USDC.** Shop takes an address and an amount. Senda builds one mainnet transaction: your USDC account, theirs, and a memo with a reference. You sign. If they have no USDC account yet, the same transaction creates it and you pay the rent. The signature is the receipt. The mint is `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. The code is [src/lib/solana-pay.ts](src/lib/solana-pay.ts).

**The number.** Make one, see it once, keep the last four and the cap. A charge debits Senda cash in this browser. Visa never sees it.

A swipe a terminal will clear needs an issuer. Phantom Cash, Jupiter, and KAST already spend Solana dollars through Lead Bank, Rain, DCS, or their own custody. Each of those is someone else’s program and someone else’s KYC. This repo does not mint them. Until there is a program, the payment a Solana address can clear is the USDC transfer.

## On the chain

Cluster is **mainnet-beta**.

| Action | What is signed | Code |
| --- | --- | --- |
| Buy, sell, convert | Jupiter swap. Simulated, then signed. | [src/lib/jup-sign.ts](src/lib/jup-sign.ts) |
| Pay | SPL transfer of USDC, plus a memo | [src/lib/solana-pay.ts](src/lib/solana-pay.ts) |
| Cover | USDC into a cover account whose key stays in this browser, plus the terms in a memo | [src/lib/cover-chain.ts](src/lib/cover-chain.ts) |
| Portfolio | A read of token accounts. Nothing is signed. | the wallet |

- Token program `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- Associated token program `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`
- Memo program `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
- Jupiter quote `https://lite-api.jup.ag/swap/v1/quote`
- RPC `https://api.mainnet-beta.solana.com`, then `https://solana-rpc.publicnode.com`
- Wallets: the Solana injector that is actually in the window. Phantom, Solflare, Backpack, and the others in [src/lib/wallets.ts](src/lib/wallets.ts). A missing extension is not drawn as connected.

Senda cash, practice play, the sheet, the agent log, and the desk-number last four live in this browser. Clearing the site clears them. They are not a chain balance.

## Not built

A brokerage account. Margin. A bank wire. A Visa or Mastercard BIN. Apple Pay. An agent key. A shift that keeps running after the tab closes. A second computer that inherits this browser’s cash.

## The chain, in Rust and Python

The page is TypeScript because the browser is where the wallet signs. The payment and the book are not.

[chain/senda-chain](chain/senda-chain) is Rust. It builds the SPL Token transfer of USDC (instruction 3, six decimals) and the cover memo. `cargo test --manifest-path chain/senda-chain/Cargo.toml`

[chain/python](chain/python) is Python. It reads `https://prestocks.com/api/prestocks`, ranks the print against the mark, and builds the same transfer and the same memo. The tests lock those bytes to the Rust crate.

```bash
PYTHONPATH=chain/python python3 -m unittest discover -s chain/python/tests
PYTHONPATH=chain/python python3 -m senda
```

The devnet cover program is `4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta`. A holder of a PreStock has the price, not the company: no legal share, no vote, no dividend. These wrappers sit outside the SEC’s September 2026 Innovation Exemption, which is for real tokenized public stocks. Most exclude U.S. persons under Regulation S. Rust and Python build the payment. The wallet signs it.

## Run

```bash
npm install
npm run dev
```

The desk is on port 8080. `npm run typecheck` has to pass. No env var is required to read the book or to ask a wallet to sign. A Jupiter API key is optional. The public RPC rate-limits. Point a private RPC at the same calls in [src/lib/phantom.ts](src/lib/phantom.ts) when you need a higher limit.

Open the book. Load practice cash and play a print. Connect a wallet and quote the same name. On Shop, paste an address and sign a dollar of USDC.

[AGENTS.md](AGENTS.md) is the manual for anyone changing the code. The same file is `CLAUDE.md`, `GEMINI.md`, and `llms.txt`. Do not invent a balance, a card, or a position the wallet does not have. Do not add a program id that was not deployed.

The submission note is [public/senda-submission.md](public/senda-submission.md).

<p align="center">
  <img src="public/og.jpg" width="720" alt="Senda">
</p>

<p align="center"><sub>ItsNotAILABS · <a href="https://github.com/ItsNotAILABS/Senda">github.com/ItsNotAILABS/Senda</a></sub></p>

## Engineering memo · September 25, 2026

Senda’s wallet foundation now includes single-use signed authorization, scoped account approvals, and encrypted continuity between devices. Each wallet’s record names and contents travel together inside an AES-GCM vault, with the encryption key held in browser memory. Revision checks protect newer saves, and wallet changes reset the active desk.

The account integration now uses a verified customer binding for each wallet, with currency-specific approval, revocation checks, idempotent requests and bounded provider timeouts. Bank details are taken from the provider’s response.

Regression coverage exercises signature replay, expiry, wallet isolation, customer revocation, concurrent saves, encrypted migration and deletion. These improvements strengthen the same principle throughout Senda: the wallet authorizes, the application checks, and state changes remain explicit.

[Engineering and rollout details](docs/wallet-security.md)
