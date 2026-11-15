import { useMemo, useState } from "react";
import { PROGRAM_BOOK, type ProgramKind } from "@/lib/program-book";
import { cn } from "@/lib/utils";

const KINDS: Array<ProgramKind | "All"> = ["All", "Program", "Market", "Pool", "Mint", "API"];

function short(address: string): string {
  if (!address) return "No address on this desk";
  if (address.startsWith("0x")) return `${address.slice(0, 6)}…${address.slice(-4)}`;
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

/** The programs, markets, and APIs this desk already calls. */
export function ProgramBook() {
  const [kind, setKind] = useState<ProgramKind | "All">("All");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PROGRAM_BOOK.filter((row) => (kind === "All" || row.kind === kind) && (!needle || `${row.name} ${row.chain} ${row.does}`.toLowerCase().includes(needle)));
  }, [kind, q]);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Registry</p>
      <h2 className="mt-1 text-xl font-semibold">Programs this desk can call.</h2>
      <p className="mt-1 text-sm text-white/55">Every address is one this app already uses. Senda did not deploy them. An API row has no program id here, so none is shown. A placeholder agency id in the repo is not on this list.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search the registry" className="mt-3 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {KINDS.map((id) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-semibold", kind === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {id}
          </button>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-white/10">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{row.name}</p>
              <p className="mt-0.5 text-[11px] text-white/40">{row.kind} · {row.chain} · <span className="font-mono">{short(row.address)}</span></p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">{row.does}</p>
            </div>
            <a href={row.href} className="mt-1 inline-flex h-9 shrink-0 items-center rounded-full border border-white/15 px-3 text-xs font-semibold">Open</a>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="py-4 text-sm text-white/45">Nothing matches.</p> : null}
    </section>
  );
}
