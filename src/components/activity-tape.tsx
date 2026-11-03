import { useEffect, useState } from "react";
import { readActs, type Act } from "@/lib/book";

/** Every Jupiter swap and USDC send, on whichever screen you are on. */
export function ActivityTape() {
  const [rows, setRows] = useState<Act[]>([]);
  useEffect(() => {
    const pull = () => setRows(readActs().slice(0, 8));
    pull();
    window.addEventListener("senda-book", pull);
    return () => window.removeEventListener("senda-book", pull);
  }, []);
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-subtle">ACTIVITY</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-subtle">Swaps and sends show here after Phantom signs. The same list is on Home, Trade, Convert, and Portfolio.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/8">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{row.title}</span>
                <span className="block truncate text-[11px] text-subtle">{row.detail}</span>
              </span>
              <a href={`https://solscan.io/tx/${row.signature}`} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-[11px] text-accent">
                {row.signature.slice(0, 4)}…{row.signature.slice(-4)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
