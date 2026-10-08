import { useEffect, useState } from "react";
import { listClears, type ClearRecord } from "@/lib/clearing";

export function ClearStrip({ desk }: { desk?: ClearRecord["desk"] }) {
  const [rows, setRows] = useState<ClearRecord[]>([]);

  useEffect(() => {
    const pull = () => {
      const all = listClears();
      setRows(desk ? all.filter((r) => r.desk === desk) : all);
    };
    pull();
    window.addEventListener("senda-clear", pull);
    return () => window.removeEventListener("senda-clear", pull);
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
