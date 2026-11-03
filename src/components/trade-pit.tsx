import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BasketDesk } from "@/components/basket-desk";
import { ChainDesk } from "@/components/chain-desk";
import { VaultMarket } from "@/components/vault-market";
import { CoinBoard } from "@/components/coin-board";
import { CommodityBook } from "@/components/commodity-book";
import { CoverDesk } from "@/components/cover-desk";
import { CurveDesk } from "@/components/curve-desk";
import { DeskNews } from "@/components/desk-news";
import { KalshiTape } from "@/components/kalshi-tape";
import { PolyTape } from "@/components/poly-tape";
import { HlTicket } from "@/components/hl-ticket";
import { PerpBooks } from "@/components/perp-books";
import { DerivDesk } from "@/components/deriv-desk";
import { FdvDesk } from "@/components/fdv-desk";
import { RegistryDesk } from "@/components/registry-desk";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { LaunchDesk } from "@/components/launch-desk";
import { LendDesk } from "@/components/lend-desk";
import { WorldDesk } from "@/components/world-desk";
import { OptionChain } from "@/components/option-chain";
import { OfferingBook } from "@/components/offering-book";
import { OstiumBook } from "@/components/ostium-book";
import { PairBook } from "@/components/pair-book";
import { PerpDesk } from "@/components/perp-desk";
import { PlayDesk } from "@/components/play-desk";
import { PreDesk } from "@/components/pre-desk";
import { RadarDesk } from "@/components/radar-desk";
import { SpotPage } from "@/components/spot-page";
import { FillButton } from "@/components/fill-button";
import { LiveChart } from "@/components/price-chart";
import { MarketIntelligence } from "@/components/market-intelligence";
import { SolanaFloor } from "@/components/solana-floor";
import { ListedView } from "@/components/desk-views";
import { WalletDesk } from "@/components/wallet-desk";
import { connectPhantom } from "@/lib/phantom";
import { getPreRoutes, runPrestock, type PreRoute } from "@/lib/prestock";
import { useEffect } from "react";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useHouse } from "@/lib/use-house";
import { jupTape, type TapeRow } from "@/lib/world-book";
import { chainFor, type OptContract, type OptTenor } from "@/lib/option-chain";
import { cn } from "@/lib/utils";

const DESKS = [
  ["matrix", "Matrix"],
  ["chart", "Chart"],
  ["news", "News"],
  ["kalshi", "Kalshi"],
  ["poly", "Polymarket"],
  ["quotes", "Quotes"],
  ["futures", "Futures"],
  ["registry", "Registry"],
  ["world", "FX & metals"],
  ["comms", "Commodities"],
  ["pairs", "Pairs"],
  ["ostium", "Ostium"],
  ["hl", "Hyperliquid"],
  ["deriv", "Derivatives"],
  ["chains", "Chains"],
  ["vaults", "Vaults"],
  ["products", "Products"],
  ["options", "Options"],
  ["perps", "Perps"],
  ["pre", "PreStocks"],
  ["bridge", "Bridge"],
  ["cards", "Spot"],
  ["xstock", "xStocks"],
  ["solana", "Solana"],
  ["tape", "Coins"],
  ["stake", "Stakes"],
  ["book", "Protect"],
  ["basket", "Index"],
  ["lend", "Borrow"],
  ["minty", "Launch"],
  ["curve", "Curve"],
  ["wrap", "Radar"],
  ["eco", "Rails"],
  ["cover", "Cover"],
] as const;

type Desk = (typeof DESKS)[number][0];

export function TradePit() {
  const house = useHouse();
  const pre = useMemo(() => house.filter((h) => h.venue === "prestocks" && h.last > 0), [house]);
  const [desk, setDesk] = useState<Desk>("matrix");
  const [underId, setUnderId] = useState<string | null>(null);
  const [armed, setArmed] = useState(1);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const [busy, setBusy] = useState(false);
  const [routes, setRoutes] = useState<PreRoute[]>([]);
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [chartId, setChartId] = useState("");
  const [chartQ, setChartQ] = useState("");
  const [chartCap, setChartCap] = useState(40);
  const under = pre.find((h) => h.id === underId) ?? pre[0] ?? null;

  useEffect(() => {
    const focus = window.sessionStorage.getItem("senda.market.focus");
    if (focus && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(focus)) setDesk("matrix");
  }, []);

  useEffect(() => {
    getPreRoutes()
      .then(setRoutes)
      .catch(() => undefined);
    jupTape()
      .then(setTape)
      .catch(() => undefined);
  }, []);

  async function buyOpt(c: OptContract) {
    const stock = pre.find((h) => h.id === c.underlyingId) ?? under;
    if (!stock) return toast.error("That name is not on the book.");
    const spend = armed > 0 ? armed : 1;
    setBusy(true);
    try {
      const owner = await connectPhantom();
      const done = await runPrestock({ owner, mint: stock.mint, side: "buy", usd: spend, price: stock.last });
      toast.success(`${c.kind} signed as $${spend} of ${stock.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The premium did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#07070f]/95 px-3 py-2 backdrop-blur">
        <p className="mb-2 text-sm text-white/55">A name, a last price, and a ticket. Phantom signs the swap.</p>
        <div className="flex gap-1 overflow-x-auto">
          {DESKS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDesk(id)}
              className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold", desk === id ? "bg-white text-black" : "text-white/60")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {desk === "matrix" ? <MarketIntelligence house={house} tape={tape} /> : null}
        {desk === "quotes" ? <SpotPage scope="all" /> : null}
        {desk === "futures" ? <FdvDesk /> : null}
        {desk === "registry" ? <RegistryDesk /> : null}
        {desk === "chart" ? (
          <ChartBook tape={tape} house={house} chartId={chartId} setChartId={setChartId} q={chartQ} setQ={setChartQ} cap={chartCap} setCap={setChartCap} />
        ) : null}
        {desk === "news" ? <DeskNews /> : null}
        {desk === "kalshi" ? <div className="px-3 py-3"><KalshiTape /></div> : null}
        {desk === "poly" ? <div className="px-3 py-3"><PolyTape /></div> : null}
        {desk === "cards" ? <SpotPage scope="coins" /> : null}
        {desk === "world" ? <WorldDesk key="fx" start="fx" /> : null}
        {desk === "comms" ? <CommodityBook /> : null}
        {desk === "pairs" ? <PairBook /> : null}
        {desk === "ostium" ? <OstiumBook /> : null}
        {desk === "hl" ? <HlTicket /> : null}
        {desk === "deriv" ? <DerivDesk /> : null}
        {desk === "chains" ? <ChainDesk /> : null}
        {desk === "vaults" ? <div className="px-3 py-3"><VaultMarket /></div> : null}
        {desk === "products" ? <div className="px-3 py-3"><OfferingBook /></div> : null}
        {desk === "options" ? (
          <div className="px-3 py-3">
            <div className="flex gap-1 overflow-x-auto">
              {pre.map((r) => (
                <button key={r.id} type="button" onClick={() => setUnderId(r.id)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm", under?.id === r.id ? "bg-white text-black" : "bg-white/10")}>
                  {r.symbol}
                </button>
              ))}
            </div>
            {under ? <p className="mt-3 text-sm text-white/55">{under.symbol} last {formatUsd(under.last)} · mark {formatUsd(under.mark)}</p> : null}
            <label className="mt-3 block text-xs text-white/45">
              Dollars
              <input inputMode="decimal" value={String(armed)} onChange={(e) => setArmed(Number(e.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono outline-none" />
            </label>
            <OptionChain stock={under} tenor={tenor} onTenor={setTenor} busy={busy} onBuy={(c) => void buyOpt(c)} />
          </div>
        ) : null}
        {desk === "perps" ? (
          <div className="space-y-4 px-3 py-3">
            <PerpDesk />
            <PerpBooks />
          </div>
        ) : null}
        {desk === "pre" ? <PreDesk names={house} routes={routes} view="book" /> : null}
        {desk === "bridge" ? <WalletDesk view="swap" /> : null}
        {desk === "solana" ? <SolanaFloor house={pre} view="mints" /> : null}
        {desk === "tape" ? <CoinBoard start="all" /> : null}
        {desk === "xstock" ? <ListedView view="market" /> : null}
        {desk === "stake" ? <PlayDesk house={house} /> : null}
        {desk === "book" ? <RadarDesk house={pre} /> : null}
        {desk === "basket" ? <BasketDesk house={pre} /> : null}
        {desk === "lend" ? <LendDesk house={pre} /> : null}
        {desk === "minty" ? <LaunchDesk /> : null}
        {desk === "curve" ? <CurveDesk /> : null}
        {desk === "wrap" ? <RadarDesk house={pre} /> : null}
        {desk === "eco" ? <EcosystemDesk house={pre} /> : null}
        {desk === "cover" ? <CoverDesk names={pre} view="all" /> : null}
      </div>
    </div>
  );
}

function ChartBook({
  tape,
  house,
  chartId,
  setChartId,
  q,
  setQ,
  cap,
  setCap,
}: {
  tape: TapeRow[];
  house: HouseListing[];
  chartId: string;
  setChartId: (id: string) => void;
  q: string;
  setQ: (q: string) => void;
  cap: number;
  setCap: (n: number | ((n: number) => number)) => void;
}) {
  const [sort, setSort] = useState<"gain" | "loss" | "price" | "name">("gain");
  const [usd, setUsd] = useState(5);
  const query = q.trim().toLowerCase();
  const seen = new Set<string>();
  const rows: { id: string; symbol: string; name: string; price: number; change: number | null }[] = [];
  for (const r of tape) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    rows.push({ id: r.id, symbol: r.symbol, name: r.name, price: r.price ?? 0, change: r.changePct ?? null });
  }
  for (const h of house) {
    if (!h.mint || seen.has(h.mint) || !(h.last > 0)) continue;
    seen.add(h.mint);
    rows.push({ id: h.mint, symbol: h.symbol, name: h.name, price: h.last, change: h.change24h == null ? null : h.change24h * 100 });
  }
  const book = rows.filter((r) => !query || `${r.symbol} ${r.name}`.toLowerCase().includes(query));
  book.sort((a, b) => {
    if (sort === "name") return a.symbol.localeCompare(b.symbol);
    if (sort === "price") return b.price - a.price;
    const av = a.change ?? -1e9;
    const bv = b.change ?? -1e9;
    return sort === "loss" ? av - bv : bv - av;
  });
  const pick = book.find((r) => r.id === chartId) ?? book[0] ?? null;

  return (
    <div className="px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Chart</p>
      <h2 className="mt-1 text-2xl font-semibold">{pick?.symbol ?? "Every coin"}</h2>
      <p className="mt-1 text-sm text-white/55">{book.length.toLocaleString("en-US")} coins. Pick one. The chart is the whole screen.</p>
      {pick ? <LiveChart page mint={pick.id} symbol={pick.symbol} live={pick.price} /> : <p className="mt-4 text-sm text-white/50">Waiting on Jupiter.</p>}
      {pick ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            {[1, 5, 25].map((n) => (
              <button key={n} type="button" onClick={() => setUsd(n)} className={cn("grid size-11 place-items-center rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15")}>
                ${n}
              </button>
            ))}
            <input inputMode="decimal" value={String(usd)} onChange={(e) => setUsd(Math.max(0, Number(e.target.value) || 0))} className="min-h-11 w-24 rounded-full bg-[#1c1c1e] px-4 font-mono text-sm outline-none" aria-label="Dollars" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <FillButton mint={pick.id} usd={usd > 0 ? usd : 1} price={pick.price} symbol={pick.symbol} label={`Buy $${usd > 0 ? usd : 1}`} className="min-h-12 rounded-full bg-[#d7e36a] text-sm font-semibold text-black" />
            <FillButton mint={pick.id} usd={usd > 0 ? usd : 1} side="sell" price={pick.price} symbol={pick.symbol} label={`Sell $${usd > 0 ? usd : 1}`} className="min-h-12 rounded-full border border-white/15 text-sm font-semibold" />
          </div>
        </div>
      ) : null}
      <input value={q} onChange={(e) => { setQ(e.target.value); setCap(40); }} placeholder="Search every coin" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {(
          [
            ["gain", "Gainers"],
            ["loss", "Losers"],
            ["price", "Price"],
            ["name", "Name"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSort(id)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", sort === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {label}
          </button>
        ))}
      </div>
      <ul className="mt-2 divide-y divide-white/10">
        {book.slice(0, cap).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setChartId(r.id)} className={cn("flex w-full items-center justify-between py-3 text-left", pick?.id === r.id && "text-[#d7e36a]")}>
              <span>
                <span className="block font-semibold">{r.symbol}</span>
                <span className="block truncate text-xs text-white/45">{r.name}</span>
              </span>
              <span className="font-mono text-sm">{r.price >= 1 ? `$${r.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : r.price > 0 ? `$${r.price.toPrecision(3)}` : "—"}</span>
            </button>
          </li>
        ))}
      </ul>
      {book.length > cap ? (
        <button type="button" onClick={() => setCap((n) => n + 40)} className="mt-2 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
          Show more · {(book.length - cap).toLocaleString("en-US")} coins
        </button>
      ) : null}
    </div>
  );
}
