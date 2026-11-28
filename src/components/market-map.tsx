import { Link } from "@tanstack/react-router";

const DOORS = [
  { label: "Crypto", line: "Jupiter coins. Buy or sell in USDC. You sign.", to: "/invest", search: { desk: "tape" } },
  { label: "Long / short", line: "Crypto, stocks, private companies, gold, and FX. You sign.", to: "/invest", search: { desk: "hl" } },
  { label: "Private", line: "Anthropic share, Anthropic valuation, OpenAI, SpaceX, Shein, Unitree. You sign.", to: "/invest", search: { desk: "hl", book: "private" } },
  { label: "Stocks", line: "Apple, Nvidia, the S&P, as tokens.", to: "/invest", search: { desk: "xstock" } },
  { label: "Pre-IPO", line: "SpaceX, OpenAI, and the other private names.", to: "/invest", search: { desk: "pre" } },
  { label: "Predict", line: "Yes or no. Kalshi can sign in Phantom.", to: "/invest", search: { desk: "kalshi" } },
  { label: "Polymarket", line: "Their ladder. The trade stays on their site.", to: "/invest", search: { desk: "poly" } },
  { label: "Jupiter perps", line: "SOL, ETH, and BTC. Margin stays on Solana.", to: "/invest", search: { desk: "perps" } },
  { label: "Peso", line: "MXNB is on Solana. The mint is empty. No SPEI here.", to: "/payments/mexico" },
  { label: "Metals", line: "Gold, silver, and FX. Live quotes.", to: "/invest", search: { desk: "world" } },
  { label: "Stack", line: "Senda's option price, a Jupiter swap, a Kamino deposit, and twenty live Solana rates.", to: "/invest", search: { desk: "stack" } },
  { label: "Conviction", line: "Write the research. Stamp the live mark. The reward is the move after, only if you were right.", to: "/invest", search: { desk: "vow" } },
  { label: "Cash", line: "Western Union’s dollar is live. MoneyGram cash-out is in Solflare. You still sign.", to: "/payments/rails" },
  { label: "Swap", line: "SOL into USDC, or back.", to: "/wallet" },
] as const;

/** The live books, in plain language. Same doors on the phone and the desk. */
export function MarketMap({ title = true, seeAll = true }: { title?: boolean; seeAll?: boolean }) {
  return (
    <section>
      {title || seeAll ? (
        <div className="flex items-baseline justify-between gap-3">
          {title ? <h2 className="text-[15px] font-semibold">Markets</h2> : <span />}
          {seeAll ? (
            <Link to="/wire" className="text-[13px] text-white/50">
              See all
            </Link>
          ) : null}
        </div>
      ) : null}
      <p className={title || seeAll ? "mt-1 text-[13px] leading-snug text-white/45" : "text-[13px] leading-snug text-white/45"}>
        Each card is a different market. Long or short is the 24/7 book. The wallet still signs.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {DOORS.map((door) => (
          <Door key={door.label} door={door} />
        ))}
      </div>
    </section>
  );
}

function Door({ door }: { door: (typeof DOORS)[number] }) {
  const className = "flex min-h-[72px] flex-col justify-center rounded-2xl bg-white/[0.06] px-3 py-2.5 active:bg-white/[0.12]";
  const body = (
    <>
      <span className="text-[15px] font-semibold">{door.label}</span>
      <span className="mt-0.5 text-[12px] leading-snug text-white/45">{door.line}</span>
    </>
  );
  if (door.to === "/wallet") {
    return (
      <Link to="/wallet" className={className}>
        {body}
      </Link>
    );
  }
  if (door.to === "/payments/mexico") {
    return (
      <Link to="/payments/mexico" className={className}>
        {body}
      </Link>
    );
  }
  if (door.to === "/payments/rails") {
    return (
      <Link to="/payments/rails" className={className}>
        {body}
      </Link>
    );
  }
  return (
    <Link to="/invest" search={door.search} className={className}>
      {body}
    </Link>
  );
}
