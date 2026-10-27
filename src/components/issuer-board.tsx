import { BACKPACK } from "@/lib/backpack";

const ROWS = [
  {
    name: "Backpack Securities",
    chain: "Solana",
    here: `${BACKPACK.length} names on this desk`,
    trade: "A Jupiter swap into the wallet. Not a share, and not a US offering.",
  },
  {
    name: "xStocks",
    chain: "Solana, and other chains",
    here: "The equity book already on this desk",
    trade: "The Solana mint swaps. The same ticker on another chain is not this row.",
  },
  {
    name: "Ondo",
    chain: "Ethereum, BNB, some Solana",
    here: "SLV and USDY",
    trade: "Only those Solana mints. The rest of their book is not this route. Ondo can refuse a wallet.",
  },
  {
    name: "Robinhood",
    chain: "Robinhood Chain",
    here: "Not listed",
    trade: "Their stocks are not Solana mints. This desk does not invent a wrapped copy.",
  },
  {
    name: "Coinbase",
    chain: "Base",
    here: "Not the stock book",
    trade: "cbBTC is a bitcoin token we already swap. Their stock tokens are a different product, on Base.",
  },
  {
    name: "bStocks",
    chain: "BNB Chain",
    here: "Not listed",
    trade: "Binance’s tokens. Not a Solana mint, and not offered to a US person.",
  },
] as const;

/** Who issues the token. Senda is not on this list. */
export function IssuerBoard() {
  return (
    <section className="px-3 py-3">
      <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">Issuers</p>
      <h2 className="mt-1 text-lg font-semibold">They issue. This desk does not.</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/55">
        The ranking you saw measures tokens outstanding. Senda has none. A wallet here can buy the Solana mints. Robinhood, Coinbase’s stocks, and bStocks sit on other chains, so they are not a row we can fill by copying a ticker.
      </p>
      <ul className="mt-3 space-y-2">
        {ROWS.map((row) => (
          <li key={row.name} className="rounded-2xl border border-white/10 px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{row.name}</p>
              <p className="text-[11px] text-white/40">{row.chain}</p>
            </div>
            <p className="mt-1 text-sm text-white/80">{row.here}</p>
            <p className="mt-1 text-[12px] leading-snug text-white/45">{row.trade}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
