import { useEffect, useState } from "react";
import { FillButton } from "@/components/fill-button";
import { screenIssued, type Issued } from "@/lib/issuer-book";

function money(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(n / 1_000)}k`;
}

/** Live Jupiter book. Liquid means at least $25,000 in the pool. */
export function ScreenDesk() {
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<"all" | "security" | "coin" | "stake">("security");
  const [liquid, setLiquid] = useState(true);
  const [rows, setRows] = useState<Issued[]>([]);
  const [note, setNote] = useState("Reading Jupiter…");

  useEffect(() => {
    let live = true;
    const handle = window.setTimeout(() => {
      screenIssued({ data: { q, family, liquid, limit: 40 } })
        .then((page) => {
          if (!live) return;
          setRows(page.rows);
          const venues = Object.entries(page.venues)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, n]) => `${name} ${n}`)
            .join(" · ");
          setNote(`${page.total.toLocaleString("en-US")} listed. ${page.securities.toLocaleString("en-US")} securities. ${page.liquid.toLocaleString("en-US")} pools over $25,000. ${venues}`);
        })
        .catch(() => live && setNote("Jupiter did not answer."));
    }, q ? 280 : 0);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [q, family, liquid]);

  return (
    <section className="px-3 py-3">
      <h2 className="text-lg font-semibold">Screener</h2>
      <p className="mt-1 text-sm text-white/50">{note}</p>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {(["security", "coin", "stake", "all"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setFamily(id)} className={family === id ? "min-h-9 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 shrink-0 rounded-full bg-white/10 px-3 text-sm"}>
            {id}
          </button>
        ))}
        <button type="button" onClick={() => setLiquid((v) => !v)} className={liquid ? "min-h-9 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 shrink-0 rounded-full bg-white/10 px-3 text-sm"}>
          {liquid ? "Liquid" : "All pools"}
        </button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Symbol or venue" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <ul className="mt-2 divide-y divide-white/10">
        {rows.map((row) => (
          <li key={row.mint} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{row.symbol}</p>
              <p className="truncate text-xs text-white/40">{row.venue} · {money(row.liquidity)} · {row.holders.toLocaleString("en-US")} holders</p>
            </div>
            {row.liquid ? (
              <FillButton mint={row.mint} usd={25} symbol={row.symbol} label="Buy $25" className="text-xs font-semibold" />
            ) : (
              <span className="text-[11px] text-white/40">Thin</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
