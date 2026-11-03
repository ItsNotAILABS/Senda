import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { readActs, readFills, type Act, type Fill } from "@/lib/book";
import { cn } from "@/lib/utils";

type Row = { id: string; ts: number; title: string; detail: string; signature: string };

function rows(): Row[] {
  const acts: Row[] = readActs().map((a: Act) => ({
    id: a.id,
    ts: a.ts,
    title: a.title,
    detail: a.detail,
    signature: a.signature,
  }));
  const fills: Row[] = readFills().map((f: Fill) => ({
    id: f.id,
    ts: f.ts,
    title: `${f.side === "sell" ? "Sold" : "Bought"} ${f.symbol}`,
    detail: `$${f.usd.toFixed(2)} · ${f.bucket}`,
    signature: f.signature,
  }));
  const seen = new Set<string>();
  return [...acts, ...fills]
    .filter((r) => {
      const key = `${r.signature}:${r.title}`;
      if (!r.signature || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20);
}

export function DeskAlerts() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Row[]>([]);
  useEffect(() => {
    const pull = () => setList(rows());
    pull();
    window.addEventListener("senda-book", pull);
    return () => window.removeEventListener("senda-book", pull);
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Alerts"
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-10 place-items-center rounded-full border border-white/10 text-white/70"
      >
        <Bell className="size-4" />
        {list.length > 0 ? <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#c6f56a]" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[22px] border border-[#c6f56a]/20 bg-[#070b08] shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">Alerts</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-white/50">
              Close
            </button>
          </div>
          {list.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-white/45">Nothing signed yet. A blocked send never lands, so it is not listed. A signature shows here.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {list.map((r) => (
                <li key={r.id} className="border-t border-white/10 px-4 py-3">
                  <a href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer" className="block">
                    <span className="block text-sm font-semibold">{r.title}</span>
                    <span className="mt-0.5 block text-xs text-white/45">{r.detail}</span>
                    <span className={cn("mt-1 block font-mono text-[11px] text-[#c6f56a]")}>
                      {r.signature.slice(0, 4)}…{r.signature.slice(-4)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
