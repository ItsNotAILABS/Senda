import { useEffect, useState } from "react";
import { FillButton } from "@/components/fill-button";
import { PAIR_MARKETS, type CatalogMarket, type MarketGroup } from "@/lib/market-catalog";
import { worldBook } from "@/lib/world-book";
import { cn } from "@/lib/utils";

const GROUPS: { id: MarketGroup; label: string }[] = [
  { id: "metal", label: "Gold and silver" },
  { id: "crypto", label: "Crypto" },
  { id: "fx", label: "Forex" },
];

function money(n: number | null) {
  if (n == null || !(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(4)}`;
}

export function PairBook() {
  const [px, setPx] = useState<Record<string, number>>({});
  const [usd, setUsd] = useState(5);

  useEffect(() => {
    let live = true;
    const pull = async () => {
      const next: Record<string, number> = {};
      const mints = PAIR_MARKETS.map((m) => m.mint).filter((m): m is string => Boolean(m));
      try {
        const res = await fetch(`https://api.jup.ag/price/v3?ids=${mints.join(",")}`);
        const json = (await res.json()) as Record<string, { usdPrice?: number }>;
        for (const mint of mints) {
          const n = json?.[mint]?.usdPrice;
          if (typeof n === "number" && n > 0) next[mint] = n;
        }
      } catch {
        /* prints can still fill the row */
      }
      try {
        const book = await worldBook();
        for (const row of PAIR_MARKETS) {
          if (!row.ostium || (row.mint && next[row.mint])) continue;
          const hit = book.find((r) => r.id === row.ostium);
          if (hit?.mid && hit.mid > 0) next[row.id] = hit.mid;
        }
      } catch {
        /* leave what Jupiter returned */
      }
      if (live) setPx(next);
    };
    void pull();
    const id = window.setInterval(() => void pull(), 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  function priceOf(row: CatalogMarket) {
    if (row.mint && px[row.mint]) return px[row.mint];
    return px[row.id] ?? null;
  }

  return (
    <div className="px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Pairs</p>
      <h2 className="mt-1 text-2xl font-semibold">Gold, crypto, forex</h2>
      <p className="mt-1 text-sm text-white/55">A row with a token signs in Phantom. A row without one is the print. New markets are added in the catalog, not in this screen.</p>
      <div className="mt-3 flex gap-2">
        {[1, 5, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("grid size-11 place-items-center rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15")}>
            ${n}
          </button>
        ))}
      </div>
      {GROUPS.map((group) => (
        <section key={group.id} className="mt-4">
          <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">{group.label}</p>
          <ul className="mt-2 divide-y divide-white/10 rounded-[22px] bg-[#101114] px-3">
            {PAIR_MARKETS.filter((row) => row.group === group.id).map((row) => {
              const price = priceOf(row);
              return (
                <li key={row.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.symbol}</p>
                      <p className="text-xs text-white/45">{row.name}{row.ostium ? ` · ${row.ostium}` : ""}</p>
                    </div>
                    <p className="font-mono text-sm">{money(price)}</p>
                  </div>
                  {row.mint ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <FillButton mint={row.mint} usd={usd} price={price ?? undefined} symbol={row.symbol} label={`Buy $${usd}`} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black" />
                      <FillButton mint={row.mint} usd={usd} side="sell" price={price ?? undefined} symbol={row.symbol} label={`Sell $${usd}`} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold" />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-white/40">Jupiter has no Solana token that will fill this print.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
