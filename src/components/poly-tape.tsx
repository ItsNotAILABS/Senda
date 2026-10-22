import { useEffect, useState } from "react";
import { polyPage, type PolyRow } from "@/lib/poly-book";

function cents(n: number | null) {
  if (n == null) return "—";
  return `${Math.round(n * 100)}¢`;
}

export function PolyTape() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PolyRow[]>([]);
  const [skip, setSkip] = useState(0);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState("Pulling Polymarket…");

  useEffect(() => {
    let live = true;
    const handle = window.setTimeout(() => {
      polyPage({ data: { q, offset: 0 } })
        .then((page) => {
          if (!live) return;
          setRows(page.rows);
          setSkip(0);
          setMore(page.more);
          setNote(page.rows.length ? `${page.rows.length} on this page. Ordered by 24h volume.` : "Nothing matched.");
        })
        .catch(() => live && setNote("Polymarket did not answer."));
    }, q ? 280 : 0);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [q]);

  function next() {
    const nextSkip = skip + 40;
    polyPage({ data: { offset: nextSkip } })
      .then((page) => {
        setSkip(nextSkip);
        setRows((cur) => [...cur, ...page.rows]);
        setMore(page.more);
      })
      .catch(() => setNote("Polymarket did not answer."));
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-white/55">Live yes-prices from Polymarket. Senda does not hold the contract. Open it there to trade it.</p>
      <p className="mt-1 text-xs text-white/40">{note}</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Polymarket" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <ul className="mt-2 divide-y divide-white/10">
        {rows.map((r) => (
          <li key={r.id}>
            <a href={`https://polymarket.com/event/${r.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.question || r.title}</span>
                <span className="block truncate text-xs text-white/45">{r.question ? r.title : "Polymarket"}</span>
              </span>
              <span className="text-right font-mono text-xs">
                <span className="block text-[#c6f56a]">{cents(r.last ?? r.bid)}</span>
                <span className="block text-white/45">{cents(r.ask)} ask</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {more && !q ? (
        <button type="button" onClick={next} className="mt-2 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
          Show more
        </button>
      ) : null}
    </div>
  );
}
