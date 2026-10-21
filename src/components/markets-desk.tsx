import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TradePad } from "@/components/fill-button";
import { LiveChart } from "@/components/price-chart";
import { NewsWire } from "@/components/news-wire";
import { PerpBooks } from "@/components/perp-books";
import { SpotCards } from "@/components/world-desk";
import { DerivDesk } from "@/components/deriv-desk";
import { XStockLane } from "@/components/xstock-desk";
import { loadTape, searchTape, bookStat, type TapeCoin } from "@/lib/jup-tape";
import { ChainMount } from "@/components/trade-mounts";
import { getEquityBook } from "@/lib/equities";
import { WORLD } from "@/lib/world-book";
import { formatPremium, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

type Lens = "trending" | "up" | "down" | "names" | "perps" | "x" | "metals" | "comms" | "fx" | "shares" | "stake" | "chains" | "stats" | "news";

function money(n: number) {
  if (!(n > 0)) return "—";
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(3)}`;
}

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function MarketsDesk({ house, coins }: { house: HouseListing[]; coins: TapeCoin[] }) {
  const [lens, setLens] = useState<Lens>("trending");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<"coin" | "name">("coin");
  const [found, setFound] = useState<TapeCoin[]>([]);
  const [watch, setWatch] = useState<string[]>([]);
  const [cap, setCap] = useState(16);
  const [liveCoins, setLiveCoins] = useState<TapeCoin[]>(coins);
  const [bookNote, setBookNote] = useState(coins.length ? `${coins.length} on the book` : "Reading the book");
  useEffect(() => {
    let live = true;
    setBookNote("Reading the book");
    Promise.all([
      loadTape().catch(() => [] as TapeCoin[]),
      getEquityBook()
        .then((book) =>
          book.stocks
            .filter((stock) => stock.mint)
            .map((stock) => ({ id: stock.mint, symbol: stock.symbol, name: stock.name || stock.symbol, price: 0, change: 0, icon: stock.logo || "" })),
        )
        .catch(() => [] as TapeCoin[]),
    ])
      .then(([tape, shares]) => {
        if (!live) return;
        const spots: TapeCoin[] = WORLD.map((asset) => ({
          id: asset.mint,
          symbol: asset.symbol,
          name: `${asset.name} · ${asset.via}`,
          price: 0,
          change: 0,
          icon: `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${asset.mint}/logo.png`,
        }));
        const seen = new Set<string>();
        const next = [...tape, ...shares, ...spots].filter((row) => (row.id && !seen.has(row.id) ? (seen.add(row.id), true) : false));
        setLiveCoins(next);
        setBookNote(next.length ? `${next.length} on the book` : "The book did not come back");
      })
      .catch(() => live && setBookNote("The book did not come back"));
    return () => {
      live = false;
    };
  }, [coins]);
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setFound([]);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      searchTape({ data: { q: needle } })
        .then((list) => live && setFound(list))
        .catch(() => live && setFound([]));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [q]);
  useEffect(() => {
    try {
      const rows = JSON.parse(window.localStorage.getItem("senda.tape.watch") || "[]") as string[];
      if (Array.isArray(rows)) setWatch(rows);
    } catch {
      setWatch([]);
    }
  }, []);
  function star(id: string) {
    setWatch((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
      window.localStorage.setItem("senda.tape.watch", JSON.stringify(next));
      return next;
    });
  }
  const needle = q.trim().toLowerCase();
  const names = useMemo(
    () => house.filter((h) => h.venue === "prestocks" && h.last > 0).sort((a, b) => Math.abs(b.change24h ?? b.premium ?? 0) - Math.abs(a.change24h ?? a.premium ?? 0)),
    [house],
  );
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const pool = [...found, ...liveCoins].filter((row) => (row.id && !seen.has(row.id) ? (seen.add(row.id), true) : false));
    return pool
      .filter((c) => !needle || `${c.symbol} ${c.name}`.toLowerCase().includes(needle))
      .filter((c) => (lens === "up" ? c.change > 0 : lens !== "down" || c.change < 0))
      .sort((a, b) => (lens === "trending" ? Math.abs(b.change) - Math.abs(a.change) : b.change - a.change));
  }, [liveCoins, found, needle, lens]);
  const named = names.filter((n) => !needle || n.symbol.toLowerCase().includes(needle));
  const coin = rows.find((c) => c.id === pick) ?? rows[0];
  const name = named.find((n) => n.mint === pick) ?? named[0];

  return (
    <div className="space-y-2 px-3 pt-2 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Markets</h1>
        <p className="truncate text-[11px] text-white/40">{bookNote}</p>
      </header>
      <div className="flex gap-1 overflow-x-auto">
        {(
          [
            ["trending", "Global"],
            ["up", "Up"],
            ["down", "Down"],
            ["names", "Names"],
            ["x", "xStocks"],
            ["metals", "Metals"],
            ["comms", "Commodities"],
            ["fx", "FX"],
            ["shares", "Share perps"],
            ["stake", "Staked SOL"],
            ["chains", "Chains"],
            ["perps", "Perps"],
            ["stats", "Analytics"],
            ["news", "News"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setLens(id);
              document.getElementById(`mkt-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", lens === id ? "bg-white text-black" : "bg-[#2a2a2e] text-white/70")}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setCap(16); }}
        placeholder="Search names, coins, xStocks"
        className="min-h-10 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none"
      />

      {lens !== "names" && coin ? (
          <section className="overflow-hidden rounded-2xl bg-[#10131c] px-3 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[#2a2a2e] text-[10px] font-bold">
                  {coin.symbol.slice(0, 2)}
                  {coin.icon ? <img src={coin.icon} alt="" className="absolute inset-0 size-9 rounded-full bg-white object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{coin.symbol}</p>
                  <p className="font-mono text-lg tabular-nums">{money(coin.price)} <span className={cn("text-xs", coin.change < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{pct(coin.change)}</span></p>
                </div>
              </div>
              <Link to="/invest" search={{ desk: "tape" }} onClick={() => window.localStorage.setItem("senda.tape.pick", coin.id)} className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-white/15 px-3 text-xs font-semibold">Open</Link>
              <button type="button" onClick={() => { setPick(coin.id); setSheet("coin"); setOpen(true); }} className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-[#d7e36a] px-3 text-xs font-semibold text-black">Trade</button>
            </div>
            <LiveChart compact mint={coin.id} symbol={coin.symbol} live={coin.price} />
            {(coin.volume || coin.liquidity || coin.mcap) ? (
              <div className="grid grid-cols-3 gap-1 px-1 pb-3 text-center">
                <div><p className="text-[10px] text-white/35">24h vol</p><p className="font-mono text-[11px]">{bookStat(coin.volume)}</p></div>
                <div><p className="text-[10px] text-white/35">Liquidity</p><p className="font-mono text-[11px]">{bookStat(coin.liquidity)}</p></div>
                <div><p className="text-[10px] text-white/35">Mkt cap</p><p className="font-mono text-[11px]">{bookStat(coin.mcap)}</p></div>
              </div>
            ) : null}
          </section>
      ) : null}

      {lens === "names" && name ? (
        <section className="overflow-hidden rounded-2xl bg-[#10131c] px-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name.symbol}</p>
              <p className="font-mono text-lg tabular-nums">{money(name.last)}</p>
            </div>
            <button type="button" onClick={() => { setSheet("name"); setOpen(true); }} className="min-h-9 shrink-0 rounded-full bg-[#d7e36a] px-3 text-xs font-semibold text-black">Trade</button>
          </div>
          <LiveChart compact mint={name.mint} symbol={name.symbol} live={name.last} />
        </section>
      ) : null}

      {lens === "news" ? null : (
        <>
          <div id="mkt-names" className="overflow-hidden rounded-2xl bg-[#10131c] px-3">
            <p className="pt-3 text-sm font-semibold">1 · Names</p>
            <NameList rows={named} onOpen={(mint) => { setPick(mint); setSheet("name"); setLens("names"); setOpen(true); }} />
          </div>
          <div id="mkt-trending" className="overflow-hidden rounded-2xl bg-[#10131c]">
            <p className="px-3 pt-3 text-sm font-semibold">2 · {lens === "up" ? "Up" : lens === "down" ? "Down" : "Coins"}</p>
            <ul>
              {[...rows].sort((a, b) => Number(watch.includes(b.id)) - Number(watch.includes(a.id))).slice(0, cap).map((c) => (
                <li key={c.id}>
                  <div className={cn("flex items-center gap-2 border-t border-white/[0.06] px-3 py-2 first:border-t-0", c.id === coin?.id ? "bg-white/[0.04]" : "")}>
                    <button type="button" onClick={() => { setPick(c.id); setSheet("coin"); setOpen(true); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-[#2a2a2e] text-[10px] font-bold text-white">
                        {c.symbol.slice(0, 2)}
                        {c.icon ? (
                          <img src={c.icon} alt="" className="absolute inset-0 size-8 rounded-full bg-white object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.symbol}</span>
                        <span className="block truncate text-[11px] text-white/45">{c.name}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-mono text-sm tabular-nums">{money(c.price)}</span>
                        <span className={cn("font-mono text-[11px]", c.change < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                          {pct(c.change)}
                        </span>
                      </span>
                    </button>
                    <button type="button" aria-label={watch.includes(c.id) ? "Unstar" : "Star"} onClick={() => star(c.id)} className={cn("text-lg", watch.includes(c.id) ? "text-[#c6f56a]" : "text-white/25")}>
                      ★
                    </button>
                  </div>
                </li>
              ))}
              {rows.length === 0 ? <li className="px-3 py-3 text-sm text-subtle">Jupiter did not return a coin.</li> : null}
              {rows.length > cap ? (
                <li>
                  <button type="button" onClick={() => setCap((n) => n + 24)} className="min-h-10 w-full text-sm font-semibold text-white/70">
                    {Math.min(cap, rows.length).toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")}. Show more
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
          <div id="mkt-x" className="overflow-hidden rounded-2xl bg-[#10131c] px-2 py-2">
            <p className="px-2 pt-2 text-sm font-semibold">3 · xStocks</p>
            <XStockLane />
          </div>
          <div id="mkt-metals" className="space-y-2">
            <p className="px-1 text-sm font-semibold">4 · Metals</p>
            <SpotCards lane="metals" />
            <DerivDesk lane="metals" lanes={["metals"]} />
          </div>
          <div id="mkt-comms" className="space-y-2">
            <p className="px-1 text-sm font-semibold">5 · Commodities, energy, indexes</p>
            <DerivDesk lane="energy" lanes={["energy", "softs", "index"]} />
          </div>
          <div id="mkt-fx" className="space-y-2">
            <p className="px-1 text-sm font-semibold">6 · FX</p>
            <SpotCards lane="fx" />
            <DerivDesk lane="fx" lanes={["fx"]} />
          </div>
          <div id="mkt-shares" className="space-y-2">
            <p className="px-1 text-sm font-semibold">7 · Share perps</p>
            <DerivDesk lane="shares" lanes={["shares"]} />
          </div>
          <div id="mkt-stake" className="space-y-2">
            <p className="px-1 text-sm font-semibold">8 · Staked SOL</p>
            <SpotCards lane="crypto" only={["jitosol", "msol", "bsol"]} />
          </div>
          <div id="mkt-chains" className="overflow-hidden rounded-2xl bg-[#10131c]">
            <p className="px-3 pt-3 text-sm font-semibold">9 · Chains</p>
            <ChainMount />
          </div>
          <div id="mkt-perps" className="overflow-hidden rounded-2xl bg-[#10131c] px-2 py-2">
            <p className="px-2 pt-2 text-sm font-semibold">10 · Perps</p>
            <PerpBooks />
          </div>
          <div id="mkt-stats">
            <p className="px-1 text-sm font-semibold">11 · Analytics</p>
            <Analytics coins={rows} names={named} />
          </div>
        </>
      )}
      <div id="mkt-news">
        <p className="px-1 text-sm font-semibold">12 · News</p>
        <NewsWire />
      </div>
      {open && (sheet === "name" ? name : coin) ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" role="dialog">
          <div className="max-h-[88vh] w-full overflow-auto rounded-t-[28px] bg-[#0c0c0f] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            {sheet === "name" && name ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/50">{name.name}</p>
                    <h2 className="text-xl font-semibold">{name.symbol}</h2>
                    <p className="mt-1 font-mono text-xl tabular-nums">{money(name.last)}</p>
                    <p className="font-mono text-sm text-[#c6f56a]">{formatPremium(name.change24h)} · mark {formatPremium(name.premium)}</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full bg-[#2a2a2e] px-4 text-sm font-semibold">Close</button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat k="Last" v={money(name.last)} />
                  <Stat k="Mark" v={money(name.mark)} />
                  <Stat k="Liquidity" v={name.liquidity > 0 ? `$${Math.round(name.liquidity).toLocaleString("en-US")}` : "—"} />
                </div>
                <div className="mt-3 overflow-hidden rounded-[22px] bg-[#101114]">
                  <LiveChart mint={name.mint} symbol={name.symbol} live={name.last} />
                </div>
                <TradePad mint={name.mint} price={name.last} symbol={name.symbol} />
              </>
            ) : coin ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/50">{coin.name}</p>
                    <h2 className="text-xl font-semibold">{coin.symbol}</h2>
                    <p className="mt-1 font-mono text-xl tabular-nums">{money(coin.price)}</p>
                    <p className={cn("font-mono text-sm", coin.change < 0 ? "text-down" : "text-[#c6f56a]")}>{pct(coin.change)} · 24h</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full bg-[#2a2a2e] px-4 text-sm font-semibold">Close</button>
                </div>
                <div className="mt-3 overflow-hidden rounded-[22px] bg-[#101114]">
                  <LiveChart mint={coin.id} symbol={coin.symbol} live={coin.price} />
                </div>
                <TradePad mint={coin.id} price={coin.price} symbol={coin.symbol} />
                <div className="mt-4">
                  <NewsWire bare desk="crypto" query={`${coin.symbol} ${coin.name}`} limit={4} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Analytics({ coins, names }: { coins: TapeCoin[]; names: HouseListing[] }) {
  const up = coins.filter((c) => c.change > 0).length;
  const down = coins.filter((c) => c.change < 0).length;
  const movers = [...coins].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 6);
  const gaps = [...names].sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0)).slice(0, 6);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[18px] bg-[#1c1c1e] px-3 py-3"><p className="text-xs text-white/45">Up</p><p className="font-mono text-2xl text-[#c6f56a]">{up}</p></div>
        <div className="rounded-[18px] bg-[#1c1c1e] px-3 py-3"><p className="text-xs text-white/45">Down</p><p className="font-mono text-2xl text-[#ff5d73]">{down}</p></div>
        <div className="rounded-[18px] bg-[#1c1c1e] px-3 py-3"><p className="text-xs text-white/45">Names</p><p className="font-mono text-2xl">{names.length}</p></div>
      </div>
      <section className="rounded-[22px] bg-[#101114] p-4">
        <h2 className="text-sm font-semibold">Biggest moves, 24h</h2>
        <ul className="mt-2 divide-y divide-white/10">
          {movers.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-semibold">{c.symbol}</span>
              <span className="text-right">
                <span className="block font-mono">{money(c.price)}</span>
                <span className={cn("font-mono text-xs", c.change < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{pct(c.change)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-[22px] bg-[#101114] p-4">
        <h2 className="text-sm font-semibold">Widest gap to the mark</h2>
        <ul className="mt-2 divide-y divide-white/10">
          {gaps.map((n) => (
            <li key={n.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="block font-semibold">{n.symbol}</span>
                <span className="block text-[11px] text-white/40">last {money(n.last)} · mark {money(n.mark)}</span>
              </span>
              <span className={cn("font-mono text-sm", (n.premium ?? 0) < 0 ? "text-[#c6f56a]" : "text-[#ff5d73]")}>{formatPremium(n.premium)}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-white/40">Counts and gaps are the live Jupiter tape and the PreStock print. No indicator is drawn without those numbers.</p>
    </div>
  );
}

function Stat({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-[18px] bg-[#1c1c1e] px-4 py-3", wide && "col-span-2")}>
      <p className="text-xs text-white/45">{k}</p>
      <p className="mt-1 font-mono text-lg tabular-nums">{v}</p>
    </div>
  );
}

function NameList({ rows, onOpen }: { rows: HouseListing[]; onOpen: (mint: string) => void }) {
  return (
    <ul className="divide-y divide-white/10">
      {rows.map((n) => {
        const ch = n.change24h == null ? null : Math.abs(n.change24h) <= 2 ? n.change24h * 100 : n.change24h;
        return (
          <li key={n.id} className="flex items-center justify-between gap-3 py-2">
            <button type="button" onClick={() => { onOpen(n.mint); }} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold">{n.symbol}</span>
              <span className="block truncate text-[11px] text-white/40">{n.name}</span>
            </button>
            <span className="text-right">
              <span className="block font-mono text-sm tabular-nums">{money(n.last)}</span>
              <span className={cn("font-mono text-xs", (ch ?? 0) < 0 ? "text-down" : "text-[#c6f56a]")}>
                {ch == null ? "no 24h" : `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%`}
              </span>
            </span>
          </li>
        );
      })}
      {rows.length === 0 ? <li className="py-3 text-sm text-subtle">No name matched.</li> : null}
    </ul>
  );
}
