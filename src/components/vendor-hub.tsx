import { Link } from "@tanstack/react-router";

const ROWS: { name: string; kind: string; does: string; to: "/invest" | "/equities" | "/loans"; search?: { desk: "term" | "pre" | "xstock" | "loans" | "perps" | "world" | "options" | "smart" | "tape" | "prog" | "cover" | "futures" | "hedge" } }[] = [
  { name: "Backpack Securities", kind: "Shares", does: "The stock mints Jupiter names as Backpack Securities. Gainers, pool, volume, and cap.", to: "/invest", search: { desk: "term" } },
  { name: "PreStocks", kind: "Pre-IPO", does: "Private names sorted by the real pool. Not a share of the company.", to: "/invest", search: { desk: "pre" } },
  { name: "xStocks", kind: "Shares", does: "Listed share tokens. Jupiter quotes the mint.", to: "/invest", search: { desk: "xstock" } },
  { name: "Kamino", kind: "Loans", does: "Main market first, then the xStocks market. Deposit, borrow, repay, withdraw. Phantom signs.", to: "/invest", search: { desk: "loans" } },
  { name: "Aave", kind: "Loans", does: "Supply and borrow on Ethereum and Base. The Ethereum wallet signs.", to: "/loans" },
  { name: "Smart route", kind: "Screener", does: "Direct lane against the routed lane. The one that pays more token is the fill.", to: "/invest", search: { desk: "smart" } },
  { name: "Jupiter Perps", kind: "Perps", does: "SOL, ETH, and BTC. Phantom signs. Senda does not hold the margin.", to: "/invest", search: { desk: "perps" } },
  { name: "FX and metals", kind: "Perps", does: "Currencies and metals on the live book.", to: "/invest", search: { desk: "world" } },
  { name: "Options", kind: "Options", does: "A call or a put. The premium is what you sign.", to: "/invest", search: { desk: "options" } },
  { name: "Cover", kind: "Cover", does: "A premium against a drop. The token is not sold.", to: "/invest", search: { desk: "cover" } },
  { name: "Futures", kind: "Futures", does: "Price exposure with a posted margin.", to: "/invest", search: { desk: "futures" } },
  { name: "Hedge", kind: "Hedge", does: "A short that is a real market, not a token sale.", to: "/invest", search: { desk: "hedge" } },
  { name: "Coins", kind: "Spot", does: "The Jupiter coin tape.", to: "/invest", search: { desk: "tape" } },
  { name: "Programs", kind: "Stake", does: "JitoSOL, a Jupiter perp, and a Meteora position. Each one asks Phantom.", to: "/invest", search: { desk: "prog" } },
  { name: "Share book", kind: "Screener", does: "The same Backpack tape on its own page.", to: "/equities" },
];

/** Every venue the trade row already runs. Not a balance. */
export function VendorHub() {
  return (
    <section className="px-3 py-3">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Vendors</p>
      <h2 className="mt-1 text-xl font-semibold">{ROWS.length} books</h2>
      <ul className="mt-3 divide-y divide-white/10">
        {ROWS.map((row) => (
          <li key={row.name}>
            <Link to={row.to} search={row.search ?? {}} className="block py-3">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{row.name}</span>
                <span className="font-mono text-[10px] tracking-wide text-white/40 uppercase">{row.kind}</span>
              </span>
              <span className="mt-1 block text-xs text-white/50">{row.does}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
