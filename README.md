# Senda

Hold a tokenized stock on Solana. Borrow against it. Spend without selling it, and without handing a store your bank card.

Senda is a web app for the Solana tokenized-equities track. The share stays yours. Cash comes from the [xStocks market on Kamino](https://app.kamino.finance/market/5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua). The buy is a real [Jupiter](https://jup.ag) route. The checkout number is one-time: it is sealed in the browser, shown once, and never stored.

## What you can do

- **Portfolio.** Live xStocks book, session hours, and how much Kamino will lend against the share you pick.
- **Trade.** PreStocks and the rest of the book, routed through Jupiter.
- **Move.** Multi-currency cash, exchange, send, and nearby transfer. A send is a pain.001.
- **Cards.** A masked one-time number for a named merchant. The PAN is not kept.
- **Play, Cover, Solana, Books.** Short-dated markets that fill on the same book, cover, the Solana venues, and the internal double-entry books.

## Run

```bash
npm install
npm run dev
```

The app listens on port 8080.
