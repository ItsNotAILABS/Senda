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
  const [other, setOther] = useState("");
  const [mode, setMode] = useState<"desk" | "sheet" | "page">("desk");
  const peer = book.find((n) => n.symbol === other);
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
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/10 bg-[#0c0c14] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Work</p>
          <h1 className="mt-3 max-w-lg text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            The book, <span className="text-accent">next to the note.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            {book.length} names on the live print. Size a position, compare two, or keep the page. Notes stay in this browser. A clerk agent writes the sheet, not this page.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ["desk", "Desk"],
                ["sheet", "Sheet"],
                ["page", "Page"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setMode(id)} className={`min-h-11 rounded-full px-5 text-sm font-semibold ${mode === id ? "bg-accent text-accent-fg" : "border border-white/15"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {book.slice().sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0)).slice(0, 1).map((n) => (
            <button key={n.id} type="button" onClick={() => setSymbol(n.symbol)} className="rounded-[28px] border border-white/10 bg-[#14f195]/10 p-5 text-left">
              <p className="text-[11px] text-accent">Cheapest versus the mark</p>
              <p className="mt-2 text-2xl font-semibold">{n.symbol}</p>
              <p className="font-mono text-sm">{formatUsd(n.last)} · {formatPremium(n.premium)}</p>
            </button>
          ))}
          {book.slice().sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0)).slice(0, 1).map((n) => (
            <button key={n.id} type="button" onClick={() => setSymbol(n.symbol)} className="rounded-[28px] border border-white/10 bg-[#ff5d73]/10 p-5 text-left">
              <p className="text-[11px] text-down">Richest versus the mark</p>
              <p className="mt-2 text-2xl font-semibold">{n.symbol}</p>
              <p className="font-mono text-sm">{formatUsd(n.last)} · {formatPremium(n.premium)}</p>
            </button>
          ))}
        </div>
      </section>

      {mode === "sheet" ? (
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101018]">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-2 py-3 text-right font-medium">Token</th>
                <th className="px-2 py-3 text-right font-medium">Mark</th>
                <th className="px-2 py-3 text-right font-medium">Vs mark</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {book.map((n) => (
                <tr key={n.id} className="border-t border-white/10">
                  <td className="px-4 py-2 font-semibold">{n.symbol}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatUsd(n.last)}</td>
                  <td className="px-2 py-2 text-right font-mono text-muted">{formatUsd(n.mark)}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatPremium(n.premium)}</td>
                  <td className="px-4 py-2">
                    <input value={sheet[n.symbol] || ""} onChange={(e) => note(n.symbol, e.target.value)} placeholder="Why you care" className="min-h-9 w-full bg-transparent text-sm outline-none placeholder:text-subtle" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {mode === "page" ? (
        <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <h2 className="text-lg">Page</h2>
          <p className="mt-1 text-xs text-muted">Yours. Stays in this browser.</p>
          <textarea value={doc} onChange={(e) => writeDoc(e.target.value)} placeholder="The note for the desk." className="mt-3 min-h-[28rem] w-full rounded-2xl bg-black/40 px-3 py-3 text-sm outline-none" />
        </section>
      ) : null}

      {mode === "desk" ? (
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
          <aside className="rounded-[28px] border border-white/10 bg-[#101018] p-2">
            {book.map((n) => (
              <button key={n.id} type="button" onClick={() => setSymbol(n.symbol)} className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm ${n.symbol === name?.symbol ? "bg-white/10" : "hover:bg-white/5"}`}>
                <span className="font-semibold">{n.symbol}</span>
                <span className="font-mono text-[11px] text-muted">{formatPremium(n.premium)}</span>
              </button>
            ))}
          </aside>
          <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
            {name ? (
              <>
                <h2 className="text-4xl">{name.symbol}</h2>
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
                  Note
                  <textarea value={sheet[name.symbol] || ""} onChange={(e) => note(name.symbol, e.target.value)} placeholder="Why this name" className="mt-1 min-h-24 w-full rounded-2xl bg-black/40 px-3 py-2 text-sm outline-none" />
                </label>
                <button type="button" onClick={pullBrief} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
                  Put this on the page
                </button>
              </>
            ) : (
              <p className="text-sm text-muted">PreStocks did not answer.</p>
            )}
          </section>
          <aside className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
            <p className="text-sm font-semibold">Compare</p>
            <select value={other} onChange={(e) => setOther(e.target.value)} className="mt-3 min-h-11 w-full rounded-2xl bg-black/40 px-3 text-sm outline-none">
              <option value="">Pick a second name</option>
              {book.filter((n) => n.symbol !== name?.symbol).map((n) => (
                <option key={n.id} value={n.symbol}>{n.symbol}</option>
              ))}
            </select>
            {name && peer ? (
              <dl className="mt-4 space-y-2 text-sm">
                <Row k="Token" a={formatUsd(name.last)} b={formatUsd(peer.last)} />
                <Row k="Vs mark" a={formatPremium(name.premium)} b={formatPremium(peer.premium)} />
                <Row k="24h" a={name.change24h == null ? "—" : `${(name.change24h * 100).toFixed(1)}%`} b={peer.change24h == null ? "—" : `${(peer.change24h * 100).toFixed(1)}%`} />
                <Row k={`$${size} buys`} a={name.last > 0 ? (size / name.last).toFixed(3) : "—"} b={peer.last > 0 ? (size / peer.last).toFixed(3) : "—"} />
              </dl>
            ) : (
              <p className="mt-3 text-xs text-muted">{name?.symbol || "A name"} against another print. Same size.</p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Row({ k, a, b }: { k: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-mono text-xs">{a}</dd>
      <dd className="text-right font-mono text-xs">{b}</dd>
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
