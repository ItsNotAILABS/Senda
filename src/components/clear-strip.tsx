import { useEffect, useState } from "react";
import { listClears, refreshClears, type ClearRecord } from "@/lib/clear-tape";
import { shortPk } from "@/lib/senda-keys";

const BUMP = "senda.clear";

/** Same-tab notice so a strip already on the page can read the new row. */
export function bumpClears(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BUMP));
}

function clock(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return "—";
  return new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ClearStrip() {
  const [rows, setRows] = useState<ClearRecord[]>([]);

  useEffect(() => {
    let live = true;
    const show = (next: ClearRecord[]) => {
      if (live) setRows(next);
    };
    show(listClears());
    refreshClears()
      .then(show)
      .catch(() => show(listClears()));
    const onBump = () => show(listClears());
    window.addEventListener(BUMP, onBump);
    return () => {
      live = false;
      window.removeEventListener(BUMP, onBump);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#10131c] px-4 py-3 text-sm">
      <h2 className="text-sm font-semibold">Cleared</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-subtle">Nothing has cleared in this browser yet.</p>
      ) : (
        <ul className="mt-1">
          {rows.map((row) => (
            <li key={row.sig} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-white/10 py-2 text-sm">
              <span className="text-subtle">{clock(row.at)}</span>
              <span>{row.kind}</span>
              <span className="font-mono tabular-nums">${row.usd.toFixed(2)}</span>
              <span className="font-mono text-subtle" title={row.sig}>
                {shortPk(row.sig)}
              </span>
              <span className="text-subtle">{row.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
