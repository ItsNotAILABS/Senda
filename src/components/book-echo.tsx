import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { kalshiPage, type KalshiRow } from "@/lib/kalshi-book";
import { polyPage, type PolyRow } from "@/lib/poly-book";
import { stashPredictQuery } from "@/lib/predict-query";

type Hit = { id: string; title: string; price: string };

function cents(n: number | null): string {
  if (n == null) return "";
  return `${Math.round(n * 100)}¢`;
}

export function BookEcho({ q, from }: { q: string; from: "kalshi" | "poly" }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Hit[]>([]);
  const [note, setNote] = useState("");
  const query = q.trim();

  useEffect(() => {
    if (query.length < 3) {
      setRows([]);
      setNote("");
      return;
    }
    let live = true;
    const handle = window.setTimeout(() => {
      const pull =
        from === "kalshi"
          ? polyPage({ data: { q: query } }).then((page) => polyHits(page.rows))
          : kalshiPage({ data: { q: query, limit: 4 } }).then((page) => kalshiHits(page.rows));
      pull
        .then((hits) => {
          if (!live) return;
          setRows(hits.slice(0, 4));
          setNote(hits.length ? "" : "Nothing on the other book.");
        })
        .catch(() => {
          if (!live) return;
          setRows([]);
          setNote("The other book did not answer.");
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [query, from]);

  if (query.length < 3) return null;

  const other = from === "kalshi" ? "Polymarket" : "Kalshi";

  return (
    <section className="mt-3 rounded-2xl bg-surface px-3 py-3">
      <p className="text-xs text-subtle">{other}. Same words, their prices. Stays on this desk.</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
      <ul className="mt-1">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => {
                stashPredictQuery(query);
                void navigate({ href: from === "kalshi" ? "/invest?desk=poly" : "/invest?desk=kalshi" });
              }}
              className="flex min-h-11 w-full items-center gap-3 py-1 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
              <span className="font-mono text-xs text-up">{row.price}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function polyHits(rows: PolyRow[]): Hit[] {
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const row of rows) {
    const id = row.eventSlug || row.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const px = cents(row.last ?? row.bid);
    out.push({
      id,
      title: row.title,
      price: px,
    });
  }
  return out;
}

function kalshiHits(rows: KalshiRow[]): Hit[] {
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const row of rows) {
    if (seen.has(row.event)) continue;
    seen.add(row.event);
    const px = row.ask ?? row.last ?? row.bid;
    out.push({ id: row.event, title: row.title, price: cents(px) });
  }
  return out;
}
