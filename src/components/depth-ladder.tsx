import { useEffect, useState } from "react";
import { marketDepth, type Level } from "@/lib/book-depth";

function cents(n: number): string {
  const c = n * 100;
  const whole = Math.round(c);
  if (Math.abs(c - whole) < 0.05) return `${whole}¢`;
  return `${c.toFixed(1)}¢`;
}

function size(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function DepthSlot({ venue, id, label }: { venue: "poly" | "kalshi"; id: string; label: string }) {
  const [ready, setReady] = useState(false);
  const [bids, setBids] = useState<Level[]>([]);
  const [asks, setAsks] = useState<Level[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!id) return;
    let live = true;
    setReady(false);
    const pull = () => {
      marketDepth({ data: { venue, id } })
        .then((book) => {
          if (!live) return;
          setBids(book.bids);
          setAsks(book.asks);
          setNote(book.note);
          setReady(true);
        })
        .catch(() => {
          if (!live) return;
          setBids([]);
          setAsks([]);
          setNote("The book did not answer.");
          setReady(true);
        });
    };
    pull();
    const timer = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [venue, id]);

  if (!id) return <p className="mt-3 text-xs text-subtle">No public book id on that contract.</p>;

  const bid = bids[0]?.price ?? null;
  const ask = asks[0]?.price ?? null;
  const spread = bid != null && ask != null && ask >= bid ? Math.round((ask - bid) * 100) : null;
  const where = venue === "poly" ? "Polymarket" : "Kalshi";

  return (
    <div className="mt-4 rounded-3xl bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-subtle">{where} · {label}</p>
        <p className="shrink-0 font-mono text-xs text-muted">{spread != null && spread > 0 ? `${spread}¢ spread` : ""}</p>
      </div>
      {!ready ? <p className="mt-3 text-sm text-muted">Reading the book…</p> : null}
      {ready && bids.length === 0 && asks.length === 0 ? <p className="mt-3 text-sm text-muted">{note || "No resting size."}</p> : null}
      {bids.length || asks.length ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-semibold text-up">Bids</p>
            <ul className="mt-1">
              {bids.map((row, i) => (
                <li key={`b${i}`} className="flex justify-between gap-2 font-mono text-sm">
                  <span className="text-up">{cents(row.price)}</span>
                  <span className="text-subtle">{size(row.size)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-down">Asks</p>
            <ul className="mt-1">
              {asks.map((row, i) => (
                <li key={`a${i}`} className="flex justify-between gap-2 font-mono text-sm">
                  <span className="text-down">{cents(row.price)}</span>
                  <span className="text-subtle">{size(row.size)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-subtle">Resting size. Not a fill. {where === "Polymarket" ? "The trade stays on their site." : "Phantom signs only if that contract already has a Solana outcome."}</p>
    </div>
  );
}
