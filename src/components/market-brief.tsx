import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PrintChart } from "@/components/print-chart";
import { loadHeadlines, type Headline } from "@/lib/wire";
import { cn } from "@/lib/utils";

function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(3)}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export type MarketStat = { label: string; value: string };

/** Chart, the numbers already on the book, and the wires that name it. No invented series. */
export function MarketBrief({
  symbol,
  name,
  mint,
  price,
  change,
  note,
  image,
  stats = [],
  news,
}: {
  symbol: string;
  name?: string;
  mint?: string;
  price?: number | null;
  change?: number | null;
  note?: string;
  image?: string;
  stats?: MarketStat[];
  news?: Headline[];
}) {
  const [tab, setTab] = useState<"book" | "news">("book");
  const [wires, setWires] = useState<Headline[]>(news ?? []);
  useEffect(() => {
    if (news) {
      setWires(news);
      return;
    }
    let live = true;
    loadHeadlines()
      .then((rows) => {
        if (live) setWires(rows);
      })
      .catch(() => {
        if (live) setWires([]);
      });
    return () => {
      live = false;
    };
  }, [news]);

  const named = wires.filter((row) => row.title.toLowerCase().includes(symbol.toLowerCase()));
  const shown = (named.length ? named : wires).slice(0, 6);
  const down = (change ?? 0) < 0;

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/55">{symbol}{name ? ` · ${name}` : ""}</p>
          <p className="mt-1 font-mono text-4xl tracking-tight tabular-nums">{price != null && price > 0 ? money(price) : "—"}</p>
          <p className={cn("mt-1 font-mono text-sm", down ? "text-down" : "text-accent")}>
            {change == null ? "No 24h print" : pct(change)}
            {note ? <span className="text-white/40"> · {note}</span> : null}
          </p>
        </div>
        {image ? <img src={image} alt="" className="size-12 rounded-full bg-white object-contain" /> : (
          <span className="grid size-12 place-items-center rounded-full bg-white text-xs font-bold text-black">{symbol.slice(0, 4)}</span>
        )}
      </div>
      <div className="flex gap-2">
        {(["book", "news"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", tab === id ? "bg-[#3a3a3c] text-white" : "text-white/50")}>
            {id === "book" ? "Overview" : "News"}
          </button>
        ))}
      </div>
      {tab === "book" ? (
        <>
          {mint ? <PrintChart mint={mint} symbol={symbol} className="h-56" /> : null}
          {mint ? (
            <Link to="/radar" search={{ mint }} className="flex min-h-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
              Trade {symbol}
            </Link>
          ) : null}
          {stats.length > 0 ? (
            <dl className="grid grid-cols-2 gap-2">
              {stats.map((row) => (
                <div key={row.label} className="rounded-2xl bg-[#1c1c1e] px-3 py-3">
                  <dt className="text-[11px] text-white/45">{row.label}</dt>
                  <dd className="mt-1 font-mono text-sm tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </>
      ) : (
        <ul className="divide-y divide-white/10">
          <li className="pb-2 text-sm font-semibold">{named.length ? `Names ${symbol}` : "Latest wires"}</li>
          {shown.map((row) => (
            <li key={row.link} className="py-3">
              <a href={row.link} target="_blank" rel="noreferrer" className="text-sm font-medium">{row.title}</a>
              <p className="mt-1 text-[11px] tracking-wide text-white/40 uppercase">{row.source}</p>
            </li>
          ))}
          {shown.length === 0 ? <li className="py-3 text-sm text-white/45">No wire came back.</li> : null}
        </ul>
      )}
    </section>
  );
}
