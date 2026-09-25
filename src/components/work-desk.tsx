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

  useEffect(() => {
    setSheet(notes());
    setDoc(window.localStorage.getItem(DOC) || "");
  }, []);

  function note(symbol: string, value: string) {
    const next = { ...sheet, [symbol]: value };
    setSheet(next);
    try {
      window.localStorage.setItem(SHEET, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }

  return (
    <main className="px-3 py-3 lg:px-4">
      <header className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Workspace</p>
        <h1 className="mt-2 text-4xl">Work next to the book.</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        A sheet of the live print, and a page that is yours. Prices come from PreStocks. Notes stay in this browser. Agents keep their own log on the Agents tab.
      </p>
      </header>

      <div className="mt-3 overflow-hidden rounded-[28px] border border-white/10 bg-[#101018]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-2 py-2 text-right font-medium">Token</th>
              <th className="px-2 py-2 text-right font-medium">Mark</th>
              <th className="px-2 py-2 text-right font-medium">Vs mark</th>
              <th className="px-4 py-2 font-medium">Your note</th>
            </tr>
          </thead>
          <tbody>
            {book.map((n) => (
              <tr key={n.id} className="border-t border-border">
                <td className="px-4 py-2 font-semibold">{n.symbol}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{formatUsd(n.last)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-muted">{formatUsd(n.mark)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{formatPremium(n.premium)}</td>
                <td className="px-4 py-2">
                  <input
                    value={sheet[n.symbol] || ""}
                    onChange={(e) => note(n.symbol, e.target.value)}
                    placeholder="Why you care"
                    className="min-h-9 w-full bg-transparent text-sm outline-none placeholder:text-subtle"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-3 rounded-[28px] border border-white/10 bg-[#101018] p-5">
        <h2 className="text-lg">Page</h2>
        <textarea
          value={doc}
          onChange={(e) => {
            setDoc(e.target.value);
            try {
              window.localStorage.setItem(DOC, e.target.value);
            } catch {
              /* quota */
            }
          }}
          placeholder="Write the desk note. It stays on this machine."
          className="mt-3 min-h-48 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none"
        />
      </section>
    </main>
  );
}
