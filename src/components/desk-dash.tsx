import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PrintChart } from "@/components/print-chart";
import { loadHeadlines, type Headline } from "@/lib/wire";
import type { TapeRow } from "@/lib/universe";
import { cn } from "@/lib/utils";

function px(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(3)}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/** Live book, the pool chart, and the public wires. Replaces the week essay. */
export function DeskDash({
  tape,
  chosen,
  onPick,
  focus = [],
}: {
  tape: TapeRow[];
  chosen?: TapeRow;
  onPick: (row: TapeRow) => void;
  focus?: string[];
}) {
  const [news, setNews] = useState<Headline[]>([]);
  const [wire, setWire] = useState("");
  const ranked = [...tape].sort((a, b) => b.change - a.change);
  const up = ranked[0];
  const down = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;
  const needles = focus.map((s) => s.toLowerCase()).filter((s) => s.length > 1);
  const mine = news.filter((row) => needles.some((s) => row.title.toLowerCase().includes(s)));
  const shown = [...mine, ...news.filter((row) => !mine.includes(row))].slice(0, 12);

  useEffect(() => {
    let live = true;
    const pull = () => {
      loadHeadlines()
        .then((rows) => {
          if (!live) return;
          setNews(rows);
          setWire("");
        })
        .catch(() => {
          if (live) setWire("The wires did not answer.");
        });
    };
    pull();
    const id = window.setInterval(pull, 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="grid gap-3">
      <div className="rounded-[28px] border border-white/10 bg-[#10131c] p-3">
        <div className="flex flex-wrap items-end justify-between gap-3 px-2 pt-1">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Live book</p>
            <h2 className="mt-1 font-display text-4xl tracking-tight">{chosen?.symbol || "—"}</h2>
            <p className="mt-1 font-mono text-2xl tabular-nums">{chosen ? px(chosen.price) : "No print yet"}</p>
            <p className={cn("font-mono text-sm tabular-nums", (chosen?.change ?? 0) < 0 ? "text-down" : "text-accent")}>
              {chosen ? pct(chosen.change) : "—"} <span className="text-white/35">24h · Jupiter</span>
            </p>
          </div>
          <div className="flex gap-2 text-right font-mono text-[11px]">
            <div className="rounded-2xl bg-black/30 px-3 py-2">
              <p className="text-white/35">Names</p>
              <p className="text-base text-white">{tape.length || "—"}</p>
            </div>
            <div className="rounded-2xl bg-black/30 px-3 py-2">
              <p className="text-white/35">Up</p>
              <p className="text-base text-accent">{up ? `${up.symbol} ${pct(up.change)}` : "—"}</p>
            </div>
            <div className="rounded-2xl bg-black/30 px-3 py-2">
              <p className="text-white/35">Down</p>
              <p className="text-base text-down">{down ? `${down.symbol} ${pct(down.change)}` : "—"}</p>
            </div>
          </div>
        </div>
        {chosen?.mint ? (
          <div className="mt-3">
            <PrintChart mint={chosen.mint} symbol={chosen.symbol} className="h-[300px]" />
          </div>
        ) : (
          <p className="mt-6 px-2 pb-6 text-sm text-white/45">Waiting on a Jupiter price.</p>
        )}
        <div className="mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {ranked.slice(0, 12).map((row) => (
            <button
              key={row.mint}
              type="button"
              onClick={() => onPick(row)}
              className={cn(
                "min-w-[108px] shrink-0 rounded-2xl border px-3 py-2 text-left",
                chosen?.mint === row.mint ? "border-accent bg-white/5" : "border-white/10 bg-black/20",
              )}
            >
              <span className="block text-xs font-semibold">{row.symbol}</span>
              <span className="mt-1 block font-mono text-[11px] tabular-nums">{px(row.price)}</span>
              <span className={cn("font-mono text-[11px] tabular-nums", row.change < 0 ? "text-down" : "text-accent")}>{pct(row.change)}</span>
            </button>
          ))}
        </div>
      </div>
      <aside className="flex max-h-72 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#141824] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">{mine.length ? "On your book" : "Wire"}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Wire</h2>
          </div>
          <Link to="/wire" className="text-xs font-semibold text-accent">All</Link>
        </div>
        <p className="mt-1 text-xs text-white/40">CoinDesk and Cointelegraph. A headline is not a trade.</p>
        {wire ? <p className="mt-4 text-sm text-down">{wire}</p> : null}
        {!wire && news.length === 0 ? <p className="mt-4 text-sm text-white/45">Pulling the wires.</p> : null}
        <ul className="mt-3 min-h-0 flex-1 divide-y divide-white/10 overflow-auto">
          {shown.map((row) => (
            <li key={row.link}>
              <a href={row.link} target="_blank" rel="noreferrer" className="block py-3">
                <span className="block text-sm leading-snug font-medium">{row.title}</span>
                <span className="mt-1 block font-mono text-[10px] tracking-wide text-white/40 uppercase">{row.source}</span>
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
