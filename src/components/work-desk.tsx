import { useEffect, useState } from "react";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";

const SHEET = "senda.sheet.v1";
const DOC = "senda.doc.v1";

function notes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const p = JSON.parse(window.localStorage.getItem(SHEET) || "{}") as Record<string, string>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

export function WorkDesk({ names }: { names: HouseListing[] }) {
  const book = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const [sheet, setSheet] = useState<Record<string, string>>({});
  const [doc, setDoc] = useState("");
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [size, setSize] = useState(100);
  const name = book.find((n) => n.symbol === symbol) ?? book[0];

  useEffect(() => {
    setSheet(notes());
    setDoc(window.localStorage.getItem(DOC) || "");
  }, []);

  function note(sym: string, value: string) {
    const next = { ...sheet, [sym]: value };
    setSheet(next);
    try {
      window.localStorage.setItem(SHEET, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }

  function writeDoc(value: string) {
    setDoc(value);
    try {
      window.localStorage.setItem(DOC, value);
    } catch {
      /* quota */
    }
  }

  function pullBrief() {
    if (!name) return;
    const tokens = name.last > 0 ? size / name.last : 0;
    const gap = (name.last - name.mark) * tokens;
    const line = `${name.symbol} — ${formatUsd(name.last)} token, ${formatUsd(name.mark)} mark, ${formatPremium(name.premium)}. $${size} is about ${tokens.toFixed(4)} tokens, ${gap >= 0 ? "+" : ""}$${gap.toFixed(2)} versus the mark. ${sheet[name.symbol] || ""}`.trim();
    writeDoc(doc ? `${doc}\n\n${line}` : line);
  }

  return (
    <div className="grid min-h-[70vh] grid-cols-1 gap-3 px-3 py-3 lg:grid-cols-[240px_minmax(0,1fr)_minmax(280px,360px)] lg:px-4">
      <aside className="rounded-[28px] border border-white/10 bg-[#101018] p-2">
        <p className="px-2 py-2 font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Names</p>
        {book.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setSymbol(n.symbol)}
            className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm ${n.symbol === name?.symbol ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            <span className="font-semibold">{n.symbol}</span>
            <span className="font-mono text-[11px] text-muted">{formatPremium(n.premium)}</span>
          </button>
        ))}
      </aside>

      <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
        {name ? (
          <>
            <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Desk</p>
            <h1 className="mt-2 text-4xl">{name.symbol}</h1>
            <p className="mt-1 text-sm text-muted">{name.name}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Tile k="Token" v={formatUsd(name.last)} />
              <Tile k="Mark" v={formatUsd(name.mark)} />
              <Tile k="24h" v={name.change24h == null ? "—" : `${(name.change24h * 100).toFixed(1)}%`} />
            </div>
            <label className="mt-5 block text-xs text-subtle">
              Size in dollars
              <input value={size} onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 0))} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-2xl bg-black/40 px-3 font-mono outline-none" />
            </label>
            <p className="mt-3 font-mono text-sm">
              {name.last > 0 ? (size / name.last).toFixed(4) : "—"} tokens · {((name.last - name.mark) * (name.last > 0 ? size / name.last : 0)).toFixed(2)} dollars versus the mark
            </p>
            <label className="mt-5 block text-xs text-subtle">
              Note on {name.symbol}
              <textarea
                value={sheet[name.symbol] || ""}
                onChange={(e) => note(name.symbol, e.target.value)}
                placeholder="Why this name, what you'd do"
                className="mt-1 min-h-28 w-full rounded-2xl bg-black/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <button type="button" onClick={pullBrief} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
              Put this on the page
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">PreStocks did not answer.</p>
        )}
      </section>

      <section className="flex flex-col rounded-[28px] border border-white/10 bg-[#101018] p-5">
        <h2 className="text-lg">Page</h2>
        <p className="mt-1 text-xs text-muted">Yours. Stays in this browser. The clerk agent writes the sheet, not this page.</p>
        <textarea
          value={doc}
          onChange={(e) => writeDoc(e.target.value)}
          placeholder="The note for the desk."
          className="mt-3 min-h-80 flex-1 rounded-2xl bg-black/40 px-3 py-3 text-sm outline-none"
        />
      </section>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-black/40 px-3 py-2">
      <p className="text-[11px] text-subtle">{k}</p>
      <p className="font-mono text-sm">{v}</p>
    </div>
  );
}
