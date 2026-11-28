import { useEffect, useMemo, useRef, useState } from "react";
import { MarkFace } from "@/components/holding-cards";
import { NameTicket } from "@/components/name-ticket";
import { CommodityBook } from "@/components/commodity-book";
import { HlTicket } from "@/components/hl-ticket";
import { KalshiTape } from "@/components/kalshi-tape";
import { NativeBoard } from "@/components/native-board";
import { OfferingBook } from "@/components/offering-book";
import { OstiumBook } from "@/components/ostium-book";
import { PairBook } from "@/components/pair-book";
import { PerpDesk } from "@/components/perp-desk";
import { PhoenixDesk } from "@/components/phoenix-desk";
import { PolyTape } from "@/components/poly-tape";
import { PortalBoard } from "@/components/portal-board";
import { RayBoard } from "@/components/ray-board";
import { EquityMount, PreMount } from "@/components/trade-mounts";
import { UsBoard } from "@/components/us-board";
import { WorldDesk } from "@/components/world-desk";
import { useCoins } from "@/components/coin-ticker";
import type { LiveCoin } from "@/lib/coin-tape";
import type { HouseListing } from "@/lib/sol-house";
import type { Headline } from "@/lib/wire";
import { loadPulse, type TapeRow } from "@/lib/universe";
import { type TapeRow as JupRow } from "@/lib/world-book";
import { tapeNow, watchTape } from "@/lib/live-tape";
import { cn } from "@/lib/utils";

type Lens = "trending" | "up" | "down" | "stocks" | "names" | "news";
type BookId = "desk" | "pre" | "xstocks" | "world" | "comms" | "ostium" | "perps" | "hl" | "phoenix" | "pairs" | "ray" | "portal" | "chains" | "us" | "offers" | "kalshi" | "poly";

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

/** The markets tab the live desk serves: Global, Up, Down, Names, News, then the pool. */
export function WireDesk({ house, coins, news }: { house: HouseListing[]; coins: LiveCoin[]; news: Headline[] }) {
  const [lens, setLens] = useState<Lens>("trending");
  const [book, setBook] = useState<BookId>("desk");
  const [pick, setPick] = useState("");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("All");
  const [cap, setCap] = useState(48);
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [wide, setWide] = useState<JupRow[]>(() => tapeNow());
  const liveCoins = useCoins();
  const [waited, setWaited] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);
  const query = q.trim().toLowerCase();
  const names = house.filter((row) => row.last > 0 && row.venue === "prestocks");
  const stocks = tape.filter((row) => row.group === "listed" && row.price > 0);
  const sources = ["All", ...Array.from(new Set(news.map((row) => row.source)))];
  useEffect(() => {
    let live = true;
    loadPulse()
      .then((pulse) => live && setTape(pulse.rows))
      .catch(() => live && setTape([]));
    const stop = watchTape((rows) => {
      if (live) setWide(rows);
    });
    return () => {
      live = false;
      stop();
    };
  }, []);
  useEffect(() => {
    if (coins.length || liveCoins.length) return;
    const id = window.setTimeout(() => setWaited(true), 6000);
    return () => window.clearTimeout(id);
  }, [coins.length, liveCoins.length]);
  useEffect(() => {
    if (!pick || lens === "news") return;
    focusRef.current?.scrollIntoView({ block: "start" });
  }, [pick, lens]);
  const coinBook = liveCoins.length ? liveCoins : coins;
  const cryptoRows = useMemo(() => {
    const base: JupRow[] = wide.length
      ? wide
      : coinBook
          .filter((row) => row.price > 0)
          .map((row) => ({ id: row.id, symbol: row.symbol, name: row.name, price: row.price, change: row.change, icon: row.icon, volume: undefined }));
    return base
      .filter((row) => !query || `${row.symbol} ${row.name}`.toLowerCase().includes(query))
      .filter((row) => (lens === "up" ? (row.change ?? 0) > 0 : lens === "down" ? (row.change ?? 0) < 0 : true))
      .sort((a, b) => {
        if (lens === "up") return (b.change ?? 0) - (a.change ?? 0);
        if (lens === "down") return (a.change ?? 0) - (b.change ?? 0);
        return (b.volume ?? 0) - (a.volume ?? 0);
      });
  }, [wide, coinBook, query, lens]);
  const stockRows = useMemo(
    () =>
      stocks
        .filter((row) => !query || row.symbol.toLowerCase().includes(query))
        .filter((row) => (lens === "up" ? row.change > 0 : lens !== "down" || row.change < 0))
        .sort((a, b) => (lens === "up" || lens === "down" ? b.change - a.change : Math.abs(b.change) - Math.abs(a.change))),
    [stocks, query, lens],
  );
  const nameRows = useMemo(
    () =>
      names
        .filter((row) => !query || `${row.symbol} ${row.name}`.toLowerCase().includes(query))
        .filter((row) => (lens === "up" ? (row.change24h ?? 0) > 0 : lens !== "down" || (row.change24h ?? 0) < 0))
        .sort((a, b) => Math.abs(b.change24h ?? b.premium ?? 0) - Math.abs(a.change24h ?? a.premium ?? 0)),
    [names, query, lens],
  );
  const headlines = news.filter((row) => (source === "All" || row.source === source) && (!query || row.title.toLowerCase().includes(query)));
  const shownStocks = stockRows.slice(0, cap);
  const shownNames = nameRows.slice(0, cap);

  return (
    <div className="px-4 pt-3 pb-8">
      <header>
        <h1 className="text-[32px] font-semibold tracking-tight">Markets</h1>
        <p className="mt-1 max-w-md text-sm leading-snug text-white/50">
          {(wide.length || coinBook.length).toLocaleString("en-US")} names on this load. Coins, stocks, pre-IPO, perps, FX, predictions. Open a name for the chart, the volume, and the ticket.
        </p>
      </header>
      <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["trending", "Crypto"],
            ["stocks", "Stocks"],
            ["up", "Gainers"],
            ["down", "Losers"],
            ["names", "Pre-IPO"],
            ["news", "News"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setLens(id); setBook("desk"); setCap(24); }} className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold", book === "desk" && lens === id ? "bg-white text-black" : "bg-white/10 text-white/75")}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["xstocks", "xStocks"],
            ["pre", "Pre desk"],
            ["world", "World"],
            ["comms", "Commodities"],
            ["phoenix", "Phoenix"],
            ["perps", "Perps"],
            ["kalshi", "Kalshi"],
            ["poly", "Polymarket"],
            ["ostium", "Ostium"],
            ["hl", "Hyperliquid"],
            ["pairs", "Pairs"],
            ["ray", "Raydium"],
            ["portal", "Portal"],
            ["chains", "Chains"],
            ["us", "US"],
            ["offers", "All books"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setBook(id)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", book === id ? "bg-[#d7e36a] text-black" : "text-white/45")}>
            {label}
          </button>
        ))}
      </div>

      {book === "desk" ? (
        <>
          <input value={q} onChange={(e) => { setQ(e.target.value); setCap(24); }} placeholder="Search a name" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
          {pick && lens !== "news" ? (
            <div ref={focusRef} className="mt-3 scroll-mt-3">
              <button type="button" onClick={() => setPick("")} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">
                Back to markets
              </button>
              <Focus lens={lens === "stocks" ? "names" : lens} pick={pick} onClose={() => setPick("")} coins={cryptoRows.map((row) => ({ id: row.id, symbol: row.symbol, name: row.name, price: row.price || 0, change: row.change || 0, icon: row.icon || "", decimals: 0, liq: row.liquidity, volume: row.volume }))} names={lens === "stocks" ? stocksAsHouse(stockRows) : nameRows} />
            </div>
          ) : lens === "news" ? (
            <section className="mt-3">
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
                {sources.map((id) => (
                  <button key={id} type="button" onClick={() => setSource(id)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", source === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
                    {id}
                  </button>
                ))}
              </div>
              <ul className="mt-2 divide-y divide-white/10">
                {headlines.map((row) => (
                  <li key={row.link} className="py-3">
                    <a href={row.link} target="_blank" rel="noreferrer" className="text-[15px] leading-snug">{row.title}</a>
                    <p className="mt-1 text-[11px] text-white/40">{row.source}</p>
                  </li>
                ))}
                {headlines.length === 0 ? <li className="py-6 text-sm text-white/45">No headlines yet.</li> : null}
              </ul>
            </section>
          ) : lens === "stocks" ? (
            <QuoteList
              rows={shownStocks.map((row) => ({
                key: row.mint,
                symbol: row.symbol,
                name: row.symbol.replace(/x$/, ""),
                mint: row.mint,
                price: px(row.price),
                change: row.change,
              }))}
              empty={tape.length ? "No listed name matched." : "Listed prices have not come back yet."}
              onOpen={setPick}
              active={pick}
            />
          ) : lens === "names" ? (
            <QuoteList
              rows={shownNames.map((row) => ({
                key: row.mint,
                symbol: row.symbol,
                name: row.name,
                mint: row.mint,
                icon: row.image,
                price: px(row.last),
                change: row.change24h == null ? null : Math.abs(row.change24h) <= 2 ? row.change24h * 100 : row.change24h,
              }))}
              empty="No pre-IPO name matched."
              onOpen={setPick}
              active={pick}
            />
          ) : (
            <QuoteList
              rows={cryptoRows.slice(0, cap).map((row) => ({
                key: row.id,
                symbol: row.symbol,
                name: row.name,
                mint: row.id,
                icon: row.icon,
                price: px(row.price || 0),
                change: row.change,
                volume: row.volume,
              }))}
              empty={wide.length || coinBook.length || !waited ? "Pulling the tape." : "Jupiter has not returned this tape."}
              onOpen={setPick}
              active={pick}
            />
          )}
          {!pick && lens !== "news" && ((lens === "stocks" ? stockRows.length : lens === "names" ? nameRows.length : cryptoRows.length) > cap) ? (
            <button type="button" onClick={() => setCap((n) => n + 24)} className="mt-3 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
              Show more
            </button>
          ) : null}
        </>
      ) : null}

      {book === "pre" ? <PreMount /> : null}
      {book === "xstocks" ? <EquityMount /> : null}
      {book === "world" ? <WorldDesk /> : null}
      {book === "comms" ? <CommodityBook /> : null}
      {book === "ostium" ? <OstiumBook /> : null}
      {book === "perps" ? <PerpDesk /> : null}
      {book === "hl" ? <HlTicket /> : null}
      {book === "phoenix" ? <PhoenixDesk /> : null}
      {book === "pairs" ? <PairBook /> : null}
      {book === "ray" ? <RayBoard /> : null}
      {book === "portal" ? <PortalBoard /> : null}
      {book === "chains" ? <NativeBoard /> : null}
      {book === "us" ? <UsBoard /> : null}
      {book === "offers" ? <OfferingBook /> : null}
      {book === "kalshi" ? <KalshiTape /> : null}
      {book === "poly" ? <PolyTape /> : null}
    </div>
  );
}

function compactVol(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B vol`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M vol`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K vol`;
  return `$${Math.round(n)} vol`;
}

function stocksAsHouse(rows: TapeRow[]): HouseListing[] {
  return rows.map((row) => ({
    id: row.mint,
    venue: "prestocks",
    mint: row.mint,
    symbol: row.symbol,
    name: row.symbol.replace(/x$/i, ""),
    question: "",
    description: "",
    last: row.price,
    mark: row.price,
    premium: null,
    valuation: 0,
    holders: 0,
    liquidity: 0,
    change24h: row.change / 100,
    url: "",
    swapUrl: "",
    sector: "Listed",
    image: "",
  }));
}

function QuoteList({
  rows,
  empty,
  onOpen,
  active,
}: {
  rows: { key: string; symbol: string; name: string; mint: string; icon?: string; price: string; change: number | null; volume?: number }[];
  empty: string;
  onOpen: (key: string) => void;
  active: string;
}) {
  return (
    <ul className="mt-3 overflow-hidden rounded-2xl bg-white/[0.04]">
      {rows.map((row) => {
        const down = (row.change ?? 0) < 0;
        return (
          <li key={row.key} className="border-b border-white/10 last:border-0">
            <button type="button" onClick={() => onOpen(row.key)} className={cn("flex w-full items-center gap-3 px-3 py-3 text-left", active === row.key && "bg-white/[0.05]")}>
              <MarkFace icon={row.icon} symbol={row.symbol} mint={row.mint} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{row.symbol}</span>
                <span className="block truncate text-[12px] text-white/45">{row.name}{row.volume ? ` · ${compactVol(row.volume)}` : ""}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-[16px] tabular-nums">{row.price}</span>
                <span className={cn("font-mono text-[12px] font-semibold tabular-nums", row.change == null ? "text-white/35" : down ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                  {row.change == null ? "—" : `${row.change >= 0 ? "+" : ""}${row.change.toFixed(2)}%`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
      {rows.length === 0 ? <li className="px-3 py-8 text-sm text-white/45">{empty}</li> : null}
    </ul>
  );
}

function Focus({ lens, pick, coins, names, onClose }: { lens: Lens; pick: string; coins: (LiveCoin & { volume?: number })[]; names: HouseListing[]; onClose: () => void }) {
  if (lens === "names") {
    const row = names.find((item) => item.mint === pick);
    if (!row) return <p className="mt-3 text-sm text-white/50">That name is not on this list.</p>;
    const ch = row.change24h == null ? null : Math.abs(row.change24h) <= 2 ? row.change24h * 100 : row.change24h;
    return <NameTicket mint={row.mint} symbol={row.symbol} title={row.name} price={row.last} change={ch} icon={row.image || undefined} onClose={onClose} />;
  }
  const row = coins.find((item) => item.id === pick);
  if (!row) return <p className="mt-3 text-sm text-white/50">That name is not on this list.</p>;
  return <NameTicket mint={row.id} volume={row.volume} symbol={row.symbol} title={row.name} price={row.price} change={row.change} icon={row.icon} onClose={onClose} />;
}

function NameList({ rows, onOpen }: { rows: HouseListing[]; onOpen: (mint: string) => void }) {
  return (
    <ul className="divide-y divide-white/10">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 py-2">
          <button type="button" onClick={() => onOpen(row.mint)} className="text-left text-sm font-semibold">{row.symbol}</button>
          <span className={cn("font-mono text-xs", (row.change24h ?? 0) >= 0 ? "text-up" : "text-down")}>
            {row.change24h == null ? "no 24h" : bookPct(row.change24h)}
            {row.premium == null ? "" : ` · mark ${bookPct(row.premium)}`}
          </span>
        </li>
      ))}
      {rows.length === 0 ? <li className="py-3 text-sm text-subtle">No name matched.</li> : null}
    </ul>
  );
}

function CoinList({ rows, empty, onOpen }: { rows: { key: string; name: string; sub: string; change: number; right: string; icon?: string }[]; empty: string; onOpen: (key: string) => void }) {
  return (
    <ul className="mt-2 divide-y divide-white/10">
      {rows.map((row) => (
        <li key={row.key}>
          <button type="button" onClick={() => onOpen(row.key)} className="flex w-full items-center gap-3 py-3 text-left">
            <MarkFace icon={row.icon} symbol={row.name} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{row.name}</span>
              <span className="block truncate text-xs text-white/45">{row.sub}</span>
            </span>
            <span className="text-right">
              <span className="block font-mono text-base tabular-nums">{row.right}</span>
              <span className={cn("font-mono text-xs", row.change >= 0 ? "text-up" : "text-down")}>{row.change >= 0 ? "▲" : "▼"} {coinPct(row.change)}</span>
            </span>
          </button>
        </li>
      ))}
      {rows.length === 0 ? <li className="py-3 text-sm text-subtle">{empty}</li> : null}
    </ul>
  );
}
