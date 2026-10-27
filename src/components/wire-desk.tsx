import { useMemo, useState } from "react";
import { DeskBots } from "@/components/desk-bots";
import { DeskStatus } from "@/components/desk-status";
import { PrintChart } from "@/components/print-chart";
import { SolBook } from "@/components/sol-book";
import type { LiveCoin } from "@/lib/coin-tape";
import type { HouseListing } from "@/lib/sol-house";
import type { Headline } from "@/lib/wire";
import { cn } from "@/lib/utils";

type Lens = "trending" | "names";

function coinPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
function bookPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}
function px(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(3)}`;
}

/** Verified Jupiter markets first. A mover tap only marks a row. A buy stays in the book. */
export function WireDesk({ house, coins, news }: { house: HouseListing[]; coins: LiveCoin[]; news: Headline[] }) {
  const [lens, setLens] = useState<Lens>("trending");
  const [pick, setPick] = useState("");
  const [source, setSource] = useState("All");
  const [newsOpen, setNewsOpen] = useState(false);

  const names = useMemo(() => house.filter((h) => h.venue === "prestocks" && h.last > 0), [house]);
  const coinMovers = useMemo(
    () => [...coins].filter((c) => c.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8),
    [coins],
  );
  const nameMovers = useMemo(
    () => [...names].sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0)).slice(0, 8),
    [names],
  );
  const sources = useMemo(() => ["All", ...Array.from(new Set(news.map((n) => n.source)))], [news]);
  const headlines = news.filter((n) => source === "All" || n.source === source);
  const offCoin = lens === "trending" ? coins.find((c) => c.id === pick && !coinMovers.some((row) => row.id === c.id)) : undefined;
  const offName = lens === "names" ? names.find((h) => h.mint === pick && !nameMovers.some((row) => row.mint === h.mint)) : undefined;

  const chartMint = lens === "names" ? (offName?.mint || nameMovers.find((row) => row.mint === pick)?.mint || names[0]?.mint || "") : (offCoin?.id || coinMovers.find((row) => row.id === pick)?.id || coins[0]?.id || "");
  const chartSymbol = lens === "names" ? (names.find((row) => row.mint === chartMint)?.symbol || "Market") : (coins.find((row) => row.id === chartMint)?.symbol || "Market");

  return (
    <div className="space-y-4 bg-black px-4 py-4">
      <header>
        <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">Solana</p>
        <h1 className="mt-1 font-display text-4xl">Markets</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">Candles, a line, or volume. The same chart. A buy is still a signature in the wallet.</p>
        <div className="mt-2">
          <DeskStatus />
        </div>
      </header>
      {chartMint ? <PrintChart mint={chartMint} symbol={chartSymbol} className="h-[280px]" /> : null}

      <DeskBots
        names={names}
        onOpen={(mint) => {
          setLens("names");
          setPick(mint);
        }}
      />

      <SolBook />

      <section className="overflow-hidden rounded-[22px] border border-white/10 bg-black">
        <div className="px-4 pt-4 pb-2">
          <h2 className="font-display text-lg">Movers</h2>
          <p className="mt-1 text-xs text-white/40">Eight coins by the day's move, then eight PreStocks.</p>
        </div>
        <p className="px-4 pt-1 pb-2 font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">Coins</p>
        {coinMovers.length === 0 ? <p className="border-t border-white/10 px-4 py-3 text-sm text-subtle">No coin move on the tape.</p> : null}
        <ul>
          {coinMovers.map((row) => (
            <li key={row.id}>
              <MoverRow
                on={lens === "trending" && pick === row.id}
                symbol={row.symbol}
                name={row.name}
                price={px(row.price)}
                change={coinPct(row.change)}
                down={row.change < 0}
                onOpen={() => {
                  setLens("trending");
                  setPick(row.id);
                }}
              />
            </li>
          ))}
        </ul>
        <p className="px-4 pt-4 pb-2 font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">PreStocks</p>
        {nameMovers.length === 0 ? <p className="border-t border-white/10 px-4 py-3 text-sm text-subtle">No PreStock name on the book.</p> : null}
        <ul>
          {nameMovers.map((row) => (
            <li key={row.mint}>
              <MoverRow
                on={lens === "names" && pick === row.mint}
                symbol={row.symbol}
                name={row.name}
                price={px(row.last)}
                change={row.change24h == null ? "no 24h" : bookPct(row.change24h)}
                down={(row.change24h ?? 0) < 0}
                onOpen={() => {
                  setLens("names");
                  setPick(row.mint);
                }}
              />
            </li>
          ))}
        </ul>
        {offCoin ? (
          <p className="flex min-h-12 items-center gap-3 border-t border-accent/30 bg-accent/10 px-4 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{offCoin.symbol}</span>
            <span className="font-mono text-xs tabular-nums">{px(offCoin.price)}</span>
            <span className={cn("font-mono text-[11px]", offCoin.change < 0 ? "text-down" : "text-up")}>{coinPct(offCoin.change)}</span>
          </p>
        ) : null}
        {offName ? (
          <p className="flex min-h-12 items-center gap-3 border-t border-accent/30 bg-accent/10 px-4 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{offName.symbol}</span>
            <span className="font-mono text-xs tabular-nums">{px(offName.last)}</span>
            <span className={cn("font-mono text-[11px]", (offName.change24h ?? 0) < 0 ? "text-down" : "text-up")}>
              {offName.change24h == null ? "no 24h" : bookPct(offName.change24h)}
            </span>
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-white/10 bg-black">
        <button
          type="button"
          aria-expanded={newsOpen}
          onClick={() => setNewsOpen((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"
        >
          <span className="font-display text-lg">News</span>
          <span className="font-mono text-[11px] tracking-wide text-white/45 uppercase">{newsOpen ? "Close" : "Open"}</span>
        </button>
        {newsOpen ? (
          <div className="border-t border-white/10">
            <div className="flex gap-1.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sources.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSource(id)}
                  className={cn("min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold", source === id ? "bg-accent text-accent-fg" : "bg-white/[0.06] text-white/70")}
                >
                  {id}
                </button>
              ))}
            </div>
            <ul className="divide-y divide-white/10 border-t border-white/10 px-4">
              {headlines.map((n) => (
                <li key={n.link} className="py-3">
                  <a href={n.link} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                    {n.title}
                  </a>
                  <p className="mt-1 text-[11px] tracking-wide text-subtle uppercase">{n.source}</p>
                </li>
              ))}
              {headlines.length === 0 ? <li className="py-4 text-sm text-subtle">Nothing matched.</li> : null}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MoverRow({
  on,
  symbol,
  name,
  price,
  change,
  down,
  onOpen,
}: {
  on: boolean;
  symbol: string;
  name: string;
  price: string;
  change: string;
  down: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onOpen}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 border-t border-white/10 px-4 text-left",
        on && "bg-accent/10 shadow-[inset_3px_0_0_#d6ff4a]",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{symbol}</span>
        <span className="block truncate text-[11px] text-white/40">{name}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-xs tabular-nums">{price}</span>
        <span className={cn("font-mono text-[11px] tabular-nums", down ? "text-down" : "text-up")}>{change}</span>
      </span>
    </button>
  );
}
