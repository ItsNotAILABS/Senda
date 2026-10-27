import { Link } from "@tanstack/react-router";

const TRADE = [
  { symbol: "AAPL", mint: "AAPLEDt8RpzPgXyhvFzkMBofvFSQw9gpeMCoUdPdLnB8" },
  { symbol: "TSLA", mint: "TSLAqBbv4CNCnzWFeB7LmydAyEiNMJtve7DYKLpdK4S" },
  { symbol: "META", mint: "METAaH6MMZZgy2CTEJq3QdNi7AFVTV3NxHFBfFgLEDd" },
];

const FUNDS = [
  { symbol: "MONY", mint: "EToDtBM2knZ8N1BHyUq2Riq5ngWTcoD3k6qpsgf7CKYY" },
  { symbol: "JLTXX", mint: "J4cTuCH6frt4AnEmKfMS2k8hsUf7K94PV62sjUJno8Cz" },
];

/** Where this desk sits against the week of Oct 20, three weeks before Breakpoint. */
export function WeekLand() {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#141824] p-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">This week · three weeks to Breakpoint</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">What landed, and what this desk will do with it</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        AAPL, TSLA, and META are on Solana through Sunrise, issued by Backpack Securities. They are on the share book. A buy or sell is a Jupiter route, and the wallet signs it. Turning the token back into the brokerage share stays with Backpack. This desk does not make that transfer.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TRADE.map((row) => (
          <Link key={row.symbol} to="/invest" className="min-h-10 rounded-full bg-white px-3 py-2 text-xs font-semibold text-black">
            {row.symbol}
          </Link>
        ))}
      </div>
      <p className="mt-3 break-all font-mono text-[10px] leading-relaxed text-white/35">
        {TRADE.map((row) => `${row.symbol} ${row.mint}`).join(" · ")}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-white/60">
        MONY and JLTXX, J.P. Morgan’s tokenized money market funds, are on Solana for qualified U.S. investors. Subscription and redemption are on Morgan Money. Neither has a retail pool, so there is no swap here. The mints below are the ones the issuer published. A same-ticker copy is not these funds.
      </p>
      <ul className="mt-2 space-y-1">
        {FUNDS.map((row) => (
          <li key={row.symbol} className="break-all font-mono text-[10px] text-white/40">
            {row.symbol} {row.mint}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-white/60">
        Alpenglow can finalize a Solana slot in about 150ms. A fill here still waits on the quote, your signature, and the landing. That time is not 150ms. Ondo’s equities on 1inch are not listed until the mint is on the Jupiter book this desk already pages. xStocks, the rest of Backpack, and a short only where a perp book exists, are already on Trade.
      </p>
    </section>
  );
}
