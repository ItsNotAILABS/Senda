import { useEffect, useState } from "react";
import { listClears, type ClearRecord } from "@/lib/clearing";

const BUMP = "senda-clear";

/** Same-tab notice so a strip already on the page reads the new row. */
export function bumpClears(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BUMP));
}

export function ClearStrip({ desk }: { desk?: ClearRecord["desk"] }) {
  const [rows, setRows] = useState<ClearRecord[]>([]);

  useEffect(() => {
    const pull = () => {
      const all = listClears();
      setRows(desk ? all.filter((r) => r.desk === desk) : all);
    };
    pull();
    window.addEventListener(BUMP, pull);
    return () => window.removeEventListener(BUMP, pull);
  }, [desk]);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Clears</h2>
        <p className="font-mono text-[11px] text-subtle">Signed moves only</p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing has cleared from this desk yet. A signature writes the row.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/10">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="font-mono text-[11px] text-subtle">{r.status}</p>
              </div>
              <p className="mt-1 font-mono text-xs text-muted">
                {r.legs.map((l) => `${l.side === "out" ? "−" : "+"}${l.amount} ${l.asset}`).join(" · ")}
                {r.sig ? ` · ${r.sig.slice(0, 8)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
