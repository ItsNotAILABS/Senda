import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listOfferings, type OfferingRow } from "@/lib/offering-book";

const LABEL: Record<string, string> = {
  name: "Names",
  listed: "Shares",
  stake: "Savings",
  spot: "Spot",
  metal: "Metals",
  fx: "FX",
  commodity: "Commodities",
  index: "Indexes",
  loan: "Loans",
  perp: "Perps",
  rail: "Send",
  ostium: "Ostium",
  chain: "Chains",
  option: "Options",
  cover: "Cover",
};

const OPEN: Record<string, "/pre" | "/xstocks" | "/market" | "/payments" | "/cover" | "/contracts"> = {
  name: "/pre",
  listed: "/xstocks",
  ostium: "/market",
  metal: "/market",
  fx: "/market",
  commodity: "/market",
  index: "/market",
  spot: "/market",
  perp: "/market",
  rail: "/payments",
  cover: "/cover",
  option: "/contracts",
  loan: "/market",
  stake: "/market",
  chain: "/market",
};

export function OfferingBook() {
  const [rows, setRows] = useState<OfferingRow[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("all");
  const [cap, setCap] = useState(40);

  useEffect(() => {
    let live = true;
    listOfferings()
      .then((next) => {
        if (live) setRows(next);
      })
      .catch((e) => {
        if (live) setErr(e instanceof Error ? e.message : "The book did not load.");
      });
    return () => {
      live = false;
    };
  }, []);

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.family, (counts.get(row.family) ?? 0) + 1);
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (family !== "all" && row.family !== family) return false;
      if (!query) return true;
      return `${row.symbol} ${row.name} ${row.venue} ${row.chain}`.toLowerCase().includes(query);
    });
  }, [rows, q, family]);
  const page = shown.slice(0, cap);

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#101114] p-4">
      <p className="text-[11px] tracking-[0.16em] text-[#c6f56a]">REGISTRY</p>
      <h2 className="mt-1 text-2xl font-semibold">Every product</h2>
      <p className="mt-2 text-sm text-white/55">
        {rows.length > 0
          ? `${rows.length} offerings are in the database. A row already stored is left alone. New markets are added. This page does not delete one.`
          : "The register writes when this page loads."}
      </p>
      <p className="mt-2 text-xs text-white/40">A buy is a wallet signature. A print is a price with no token. Pre-IPO names are not shares and not a vote.</p>
      {err ? <p className="mt-2 text-sm text-down">{err}</p> : null}
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setCap(40);
        }}
        placeholder="Search every product"
        className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 text-sm outline-none"
      />
      {counts.size > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => { setFamily("all"); setCap(40); }} className={family === "all" ? "shrink-0 rounded-full bg-white px-3 py-1 font-mono text-xs text-black" : "shrink-0 rounded-full bg-black/40 px-3 py-1 font-mono text-xs text-white/70"}>
            All {rows.length}
          </button>
          {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
            <button key={id} type="button" onClick={() => { setFamily(id); setCap(40); }} className={family === id ? "shrink-0 rounded-full bg-white px-3 py-1 font-mono text-xs text-black" : "shrink-0 rounded-full bg-black/40 px-3 py-1 font-mono text-xs text-white/70"}>
              {LABEL[id] ?? id} {n}
            </button>
          ))}
        </div>
      ) : null}
      {page.length > 0 ? (
        <ul className="mt-3 divide-y divide-white/10">
          {page.map((row) => {
            const to = OPEN[row.family] ?? "/market";
            return (
              <li key={row.id} className="flex items-baseline justify-between gap-3 py-2">
                <Link to={to} className="min-w-0">
                  <span className="text-sm font-semibold">{row.symbol}</span>
                  <span className="ml-2 text-xs text-white/40">{row.name}</span>
                </Link>
                <span className="shrink-0 font-mono text-[11px] text-white/45">{row.status}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {shown.length > page.length ? (
        <button type="button" onClick={() => setCap((n) => n + 80)} className="mt-3 min-h-10 rounded-full border border-white/15 px-4 text-sm">
          Show more · {shown.length - page.length} left
        </button>
      ) : null}
    </section>
  );
}
