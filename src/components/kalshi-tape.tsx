import { useEffect, useState } from "react";
import { kalshiPage, type KalshiRow } from "@/lib/kalshi-book";
import { cn } from "@/lib/utils";

function cents(n: number | null) {
  if (n == null) return "—";
  return `${Math.round(n * 100)}¢`;
}

function vol(n: number) {
  if (!(n > 0)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function KalshiTape() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [rows, setRows] = useState<KalshiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [done, setDone] = useState(false);
  const [cats, setCats] = useState<{ id: string; n: number }[]>([]);
  const [note, setNote] = useState("Pulling the open Kalshi book…");

  useEffect(() => {
    let live = true;
    const handle = window.setTimeout(() => {
      setNote("Pulling the open Kalshi book…");
      kalshiPage({ data: { q, category: cat, offset: 0, limit: 40 } })
        .then((page) => {
          if (!live) return;
          setRows(page.rows);
          setTotal(page.total);
          setLoaded(page.loaded);
          setDone(page.done);
          setCats(page.categories);
          setNote(
            page.loaded
              ? `${page.total.toLocaleString("en-US")} match · ${page.loaded.toLocaleString("en-US")} loaded${page.done ? "" : ", still reading Kalshi"}`
              : "Kalshi did not answer.",
          );
        })
        .catch(() => live && setNote("Kalshi did not answer."));
    }, q ? 280 : 0);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [q, cat]);

  function more() {
    kalshiPage({ data: { q, category: cat, offset: rows.length, limit: 40 } })
      .then((page) => {
        setRows((cur) => [...cur, ...page.rows]);
        setTotal(page.total);
        setLoaded(page.loaded);
        setDone(page.done);
      })
      .catch(() => setNote("Kalshi did not answer."));
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-white/55">
        Live yes-prices from Kalshi. Senda does not hold the contract. Open the market there to trade it.
      </p>
      <p className="mt-1 text-xs text-white/40">{note}</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Kalshi"
        className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none"
      />
      <div className="mt-3 flex gap-1 overflow-x-auto">
        <button type="button" onClick={() => setCat("")} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", cat === "" ? "bg-white text-black" : "bg-white/10 text-white/70")}>
          All
        </button>
        {cats.slice(0, 16).map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", cat === c.id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {c.id} {c.n > 999 ? `${Math.round(c.n / 1000)}k` : c.n}
          </button>
        ))}
      </div>
      <ul className="mt-2 divide-y divide-white/10">
        {rows.map((r) => (
          <li key={r.ticker}>
            <a href={`https://kalshi.com/markets/${(r.event || r.ticker).toLowerCase()}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.yes || r.title}</span>
                <span className="block truncate text-xs text-white/45">{r.yes ? r.title : r.category} · {r.category} · vol {vol(r.vol)}</span>
              </span>
              <span className="text-right font-mono text-xs">
                <span className="block text-[#c6f56a]">{cents(r.bid)}</span>
                <span className="block text-white/45">{cents(r.ask)} ask</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="py-6 text-sm text-muted">Nothing matched yet.</p> : null}
      {rows.length < total ? (
        <button type="button" onClick={more} className="mt-2 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
          Show more · {(total - rows.length).toLocaleString("en-US")} still on Kalshi{done ? "" : " · book still loading"}
        </button>
      ) : null}
    </div>
  );
}
