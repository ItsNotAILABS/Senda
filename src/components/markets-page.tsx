import { useEffect, useState } from "react";
import { MarkFace } from "@/components/holding-cards";
import { jupTape, searchTape, type TapeRow } from "@/lib/world-book";
import { useHouse } from "@/lib/use-house";
import { FillButton } from "@/components/fill-button";
import { LiveChart } from "@/components/price-chart";
import { ListedView } from "@/components/desk-views";
import { OstiumBook } from "@/components/ostium-book";
import { PhoenixDesk } from "@/components/phoenix-desk";
import { PairBook } from "@/components/pair-book";
import { PerpDesk } from "@/components/perp-desk";
import { SolanaFloor } from "@/components/solana-floor";
import { ChainDesk } from "@/components/chain-desk";
import { CommodityBook } from "@/components/commodity-book";
import { OfferingBook } from "@/components/offering-book";
import { WorldDesk } from "@/components/world-desk";
import { DeskNews } from "@/components/desk-news";
import { VaultMarket } from "@/components/vault-market";
import { KalshiTape } from "@/components/kalshi-tape";
import { PolyTape } from "@/components/poly-tape";
import { HlTicket } from "@/components/hl-ticket";
import { PerpBooks } from "@/components/perp-books";
import { DerivDesk } from "@/components/deriv-desk";
import { FdvDesk } from "@/components/fdv-desk";
import { RegistryDesk } from "@/components/registry-desk";
import { ScreenDesk } from "@/components/screen-desk";
import { VendorHub } from "@/components/vendor-hub";
import { BasketDesk } from "@/components/basket-desk";
import { BundleDesk } from "@/components/bundle-desk";
import { CoverDesk } from "@/components/cover-desk";
import { CurveDesk } from "@/components/curve-desk";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { LaunchDesk } from "@/components/launch-desk";
import { EarnDesk } from "@/components/earn-desk";
import { ReflectDesk } from "@/components/reflect-desk";
import { LendDesk } from "@/components/lend-desk";
import { PlayDesk } from "@/components/play-desk";
import { RadarDesk } from "@/components/radar-desk";
import { NetBrief, NetworkSheet } from "@/components/network-sheet";
import { PHANTOM_NETS, netMatches } from "@/lib/chain-book";
import { PRESTOCK_MINTS } from "@/lib/phantom";
import { cn } from "@/lib/utils";

type Tab = "trending" | "up" | "down" | "names" | "registry" | "futures" | "kalshi" | "poly" | "fx" | "metals" | "energy" | "softs" | "index" | "comms" | "pairs" | "ostium" | "hl" | "deriv" | "chains" | "vaults" | "earn" | "reflect" | "products" | "shares" | "perps" | "phoenix" | "solana" | "stake" | "basket" | "bundles" | "lend" | "cover" | "radar" | "curve" | "launch" | "rails" | "news";

const TITLES: Record<Tab, string> = {
  trending: "Coins",
  up: "Up",
  down: "Down",
  names: "PreStocks",
  registry: "Registry",
  futures: "Futures",
  kalshi: "Kalshi",
  poly: "Polymarket",
  fx: "FX",
  metals: "Metals",
  energy: "Energy",
  softs: "Softs",
  index: "Indexes",
  comms: "Commodities",
  pairs: "Pairs",
  ostium: "Ostium",
  hl: "Hyperliquid",
  deriv: "Derivatives",
  chains: "Chains",
  vaults: "Vaults",
  earn: "Earn",
  reflect: "Reflect",
  products: "Products",
  shares: "xStocks",
  perps: "Perps",
  phoenix: "Phoenix",
  solana: "Solana",
  stake: "Stakes",
  basket: "Index",
  bundles: "Baskets",
  lend: "Borrow",
  cover: "Cover",
  radar: "Radar",
  curve: "Curve",
  launch: "Launch",
  rails: "Rails",
  news: "News",
};

function coinTab(tab: Tab) {
  return tab === "trending" || tab === "up" || tab === "down";
}

function formatPx(n: number) {
  if (!(n > 0)) return "—";
  return n >= 1 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `$${n.toPrecision(3)}`;
}

export function MarketsPage({ initial }: { initial?: string }) {
  const book = useHouse();
  const house = book.filter((h) => h.venue === "prestocks" && (h.last > 0 || PRESTOCK_MINTS.some(([symbol]) => symbol === h.symbol)));
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [hits, setHits] = useState<TapeRow[]>([]);
  const [tab, setTab] = useState<Tab>(initial && initial in TITLES ? (initial as Tab) : "trending");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<TapeRow | null>(null);
  const [nameId, setNameId] = useState("");
  const [sort, setSort] = useState<"gain" | "loss" | "price" | "name">("gain");
  const [cap, setCap] = useState(120);
  const [shape, setShape] = useState<"rows" | "cards">("cards");
  const [usd, setUsd] = useState(5);
  const [netId, setNetId] = useState("solana");
  const [sheet, setSheet] = useState(false);
  const net = PHANTOM_NETS.find((n) => n.id === netId) ?? PHANTOM_NETS[0];

  useEffect(() => {
    if (window.location.hash === "#vaults") setTab("vaults");
  }, []);

  useEffect(() => {
    let live = true;
    const pull = () => {
      jupTape()
        .then((rows) => live && setTape(rows))
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  const query = q.trim().toLowerCase();

  useEffect(() => {
    if (query.length < 2) {
      setHits([]);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      searchTape({ data: query })
        .then((rows) => live && setHits(rows))
        .catch(() => live && setHits([]));
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const local = tape.filter((r) => !query || `${r.symbol} ${r.name} ${r.id}`.toLowerCase().includes(query));
  const coins = query.length < 2 ? local : [...hits, ...local.filter((r) => !hits.some((h) => h.id === r.id))];
  const shown = (tab === "up" ? coins.filter((r) => (r.change ?? 0) > 0) : tab === "down" ? coins.filter((r) => (r.change ?? 0) < 0) : coins)
    .slice()
    .sort((a, b) => {
      if (sort === "name") return a.symbol.localeCompare(b.symbol);
      if (sort === "price") return (b.price ?? 0) - (a.price ?? 0);
      const av = a.change == null ? -1e9 : Math.abs(a.change) <= 2 ? a.change * 100 : a.change;
      const bv = b.change == null ? -1e9 : Math.abs(b.change) <= 2 ? b.change * 100 : b.change;
      return sort === "loss" ? av - bv : bv - av;
    });
  const names = house.filter((h) => (!query || `${h.symbol} ${h.name}`.toLowerCase().includes(query)) && netMatches(net, h.symbol));
  const name = names.find((h) => h.id === nameId) ?? names[0] ?? null;
  const coinsOnNet = shown.filter((r) => netMatches(net, r.symbol));
  const listed = query ? coinsOnNet : coinsOnNet.slice(0, cap);
  const spend = usd > 0 ? usd : 1;
  const tabGroups: { label: string; ids: Tab[] }[] = [
    { label: "Trade", ids: ["trending", "up", "down", "shares", "names"] },
    { label: "Predict", ids: ["kalshi", "poly", "futures", "news"] },
    { label: "Derivatives", ids: ["perps", "phoenix", "ostium", "hl", "deriv", "pairs", "cover"] },
    { label: "World", ids: ["fx", "metals", "energy", "softs", "index", "comms"] },
    { label: "Yield", ids: ["earn", "reflect", "stake", "vaults", "lend", "basket", "bundles"] },
    { label: "Networks", ids: ["chains", "solana", "rails", "registry", "products", "radar", "curve", "launch"] },
  ];

  return (
    <div className="px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Markets</p>
        <h1 className="mt-1 text-3xl tracking-tight">{TITLES[tab]}</h1>
        <p className="mt-1 max-w-xl text-sm text-white/50">
          {coinTab(tab)
            ? `${coinsOnNet.length.toLocaleString("en-US")} on this filter.${query.length >= 2 ? " Jupiter search is included, deepest pool first. The same ticker can be more than one mint." : ""} ${shape === "cards" ? "Cards are the coin book." : "Same coins, as a list."}`
            : `${TITLES[tab]} stays its own book. Nothing else was removed.`}
        </p>
      </header>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setSheet(true)} className="min-h-9 rounded-full bg-white/10 px-3 text-sm font-semibold">
          {net.mark} {net.name}{net.badge ? ` · ${net.badge}` : ""}
        </button>
        {(
          [
            ["rows", "Rows"],
            ["cards", "Cards"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setShape(id);
              if (id === "cards" && !coinTab(tab)) setTab("trending");
            }}
            className={shape === id ? "min-h-9 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 rounded-full bg-white/10 px-3 text-sm font-semibold text-white/70"}
          >
            {label}
          </button>
        ))}
      </div>
      <NetworkSheet open={sheet} current={net.id} onClose={() => setSheet(false)} onPick={setNetId} />
      {net.id !== "solana" ? <NetBrief net={net} /> : null}
      <div className="mt-3 flex gap-3 overflow-x-auto">
        {tabGroups.map((group) => (
          <div key={group.label} className="shrink-0">
            <p className="mb-1 text-[10px] tracking-[0.14em] text-white/35 uppercase">{group.label}</p>
            <div className="flex gap-1">
              {group.ids.map((id) => (
                <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? "min-h-9 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 shrink-0 rounded-full px-3 text-sm text-white/60"}>
                  {TITLES[id]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setCap(120); }} placeholder="Search a ticker or a mint" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
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
      {coinTab(tab) || tab === "names" ? (
        <div className="mt-3 flex items-center gap-2">
          {[1, 5, 25].map((n) => (
            <button key={n} type="button" onClick={() => setUsd(n)} className={usd === n ? "grid size-11 place-items-center rounded-full bg-white text-sm font-semibold text-black" : "grid size-11 place-items-center rounded-full border border-white/15 text-sm font-semibold"}>
              ${n}
            </button>
          ))}
          <input
            inputMode="decimal"
            value={String(usd)}
            onChange={(e) => setUsd(Math.max(0, Number(e.target.value) || 0))}
            className="min-h-11 w-24 rounded-full bg-[#1c1c1e] px-4 font-mono text-sm outline-none"
            aria-label="Dollars"
          />
        </div>
      ) : null}
      {tab === "fx" ? <WorldDesk start="fx" /> : null}
      {tab === "metals" ? <WorldDesk start="metals" /> : null}
      {tab === "energy" ? <WorldDesk start="energy" /> : null}
      {tab === "softs" ? <WorldDesk start="softs" /> : null}
      {tab === "index" ? <WorldDesk start="index" /> : null}
      {tab === "comms" ? <CommodityBook /> : null}
      {tab === "pairs" ? <PairBook /> : null}
      {tab === "ostium" ? <OstiumBook /> : null}
      {tab === "hl" ? <HlTicket /> : null}
      {tab === "deriv" ? <DerivDesk /> : null}
      {tab === "chains" ? <ChainDesk /> : null}
      {tab === "vaults" ? <VaultMarket /> : null}
      {tab === "earn" ? <EarnDesk /> : null}
      {tab === "reflect" ? <ReflectDesk /> : null}
      {tab === "products" ? <div className="mt-3"><VendorHub /><OfferingBook /></div> : null}
      {tab === "shares" ? <ListedView view="market" /> : null}
      {tab === "perps" ? (
        <div className="mt-3 space-y-4">
          <PerpDesk />
          <PerpBooks />
        </div>
      ) : null}
      {tab === "phoenix" ? <PhoenixDesk /> : null}
      {tab === "solana" ? <SolanaFloor house={book} view="mints" /> : null}
      {tab === "news" ? <DeskNews flush /> : null}
      {tab === "kalshi" ? <KalshiTape /> : null}
      {tab === "poly" ? <PolyTape /> : null}
      {tab === "futures" ? <FdvDesk /> : null}
      {tab === "registry" ? <><ScreenDesk /><RegistryDesk /></> : null}
      {tab === "stake" ? <PlayDesk house={book} /> : null}
      {tab === "basket" ? <BasketDesk house={house} /> : null}
      {tab === "bundles" ? <BundleDesk /> : null}
      {tab === "lend" ? <LendDesk house={house} /> : null}
      {tab === "cover" ? <CoverDesk names={house} view="all" /> : null}
      {tab === "radar" ? <RadarDesk house={house} /> : null}
      {tab === "curve" ? <CurveDesk /> : null}
      {tab === "launch" ? <LaunchDesk /> : null}
      {tab === "rails" ? <><VendorHub /><EcosystemDesk house={house} /></> : null}
      {tab === "names" ? (
        <>
          <ul className="mt-3 divide-y divide-white/10 rounded-[22px] bg-[#101114] px-4">
            <li className="pt-3 text-sm font-semibold">Names</li>
            {names.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => setNameId(h.id)} className="flex w-full items-center justify-between py-3 text-left">
                  <p className="text-sm font-semibold">{h.symbol}</p>
                  <p className={cn("font-mono text-xs", (h.change24h ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                    {h.change24h == null ? "—" : `${(Math.abs(h.change24h) <= 2 ? h.change24h * 100 : h.change24h).toFixed(1)}%`}
                    {" · "}
                    {formatPx(h.last)}
                  </p>
                </button>
              </li>
            ))}
            {names.length === 0 ? <li className="py-6 text-sm text-muted">No name matched.</li> : null}
          </ul>
          {name?.mint ? (
            <section className="mt-3 rounded-[22px] bg-[#101114] p-3">
              <p className="text-sm font-semibold">{name.symbol}</p>
              <div className="mt-2 overflow-hidden rounded-2xl bg-black/30">
                <LiveChart compact mint={name.mint} symbol={name.symbol} live={name.last} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <FillButton mint={name.mint} usd={spend} price={name.last} symbol={name.symbol} label={`Buy $${spend}`} className="min-h-11 rounded-full bg-[#d7e36a] text-sm font-semibold text-black" />
                <FillButton mint={name.mint} usd={spend} side="sell" price={name.last} symbol={name.symbol} label={`Sell $${spend}`} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold" />
              </div>
            </section>
          ) : null}
        </>
      ) : tab === "trending" || tab === "up" || tab === "down" ? (
        shape === "cards" ? (
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {listed.map((r) => {
              const chg = r.change == null ? null : Math.abs(r.change) <= 2 ? r.change * 100 : r.change;
              return (
                <li key={r.id} className="flex min-h-[168px] flex-col rounded-[22px] border border-white/10 bg-[#10131c] p-3">
                  <button type="button" onClick={() => setOpen(r)} className="text-left">
                    <MarkFace icon={r.icon} symbol={r.symbol} mint={r.id} size={36} />
                    <span className="mt-2 block truncate font-semibold">{r.symbol}</span>
                    <span className="block truncate font-mono text-[10px] text-white/35">{r.id.slice(0, 4)}…{r.id.slice(-4)}{r.liquidity ? ` · pool $${Math.round(r.liquidity).toLocaleString("en-US")}` : ""}</span>
                    <span className="block font-mono text-lg">{r.price == null ? "—" : formatPx(r.price)}</span>
                    <span className={chg != null && chg < 0 ? "text-xs text-[#ff5d73]" : "text-xs text-[#c6f56a]"}>{chg == null ? "" : `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`}</span>
                  </button>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                    <FillButton mint={r.id} usd={spend} price={r.price ?? 0} symbol={r.symbol} label={`Buy $${spend}`} className="min-h-10 rounded-full bg-[#d7e36a] text-xs font-semibold text-black" />
                    <FillButton mint={r.id} usd={spend} side="sell" price={r.price ?? 0} symbol={r.symbol} label={`Sell $${spend}`} className="min-h-10 rounded-full border border-white/15 text-xs font-semibold" />
                  </div>
                </li>
              );
            })}
            {coinsOnNet.length > listed.length ? (
              <li className="col-span-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCap((n) => n + 40)} className="min-h-11 rounded-full bg-white/10 text-sm font-semibold">
                  More
                </button>
                <button type="button" onClick={() => setCap(coinsOnNet.length)} className="min-h-11 rounded-full bg-white/10 text-sm font-semibold">
                  All {coinsOnNet.length.toLocaleString("en-US")}
                </button>
              </li>
            ) : null}
          </ul>
        ) : (
          <ul className="mt-2">
            {listed.map((r) => {
              const chg = r.change == null ? null : Math.abs(r.change) <= 2 ? r.change * 100 : r.change;
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 py-3 text-left">
                    <MarkFace icon={r.icon} symbol={r.symbol} mint={r.id} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{r.symbol}</span>
                      <span className="block truncate text-xs text-muted">{r.name} · {r.id.slice(0, 4)}…{r.id.slice(-4)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm">{r.price == null ? "—" : formatPx(r.price)}</span>
                      <span className={chg != null && chg < 0 ? "text-xs text-[#ff5d73]" : "text-xs text-[#c6f56a]"}>{chg == null ? "no 24h" : `${chg >= 0 ? "▲ +" : "▼ "}${Math.abs(chg).toFixed(1)}%`}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {coinsOnNet.length === 0 ? <li className="py-6 text-sm text-muted">Nothing on this network is on the Jupiter book.</li> : null}
            {coinsOnNet.length > listed.length ? (
              <li className="grid grid-cols-2 gap-2 py-3">
                <button type="button" onClick={() => setCap((n) => n + 40)} className="min-h-11 rounded-full bg-white/10 text-sm font-semibold">
                  More
                </button>
                <button type="button" onClick={() => setCap(coinsOnNet.length)} className="min-h-11 rounded-full bg-white/10 text-sm font-semibold">
                  All {coinsOnNet.length.toLocaleString("en-US")}
                </button>
              </li>
            ) : null}
          </ul>
        )
      ) : null}
      {open && coinTab(tab) ? (
        <section className="mt-2 rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-sm font-semibold">{open.symbol}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted">{open.name} · {open.id}</p>
          <div className="mt-3 overflow-hidden rounded-2xl bg-black/30">
            <LiveChart compact mint={open.id} symbol={open.symbol} live={open.price ?? 0} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <FillButton mint={open.id} usd={spend} price={open.price ?? 0} symbol={open.symbol} label={`Buy $${spend} ${open.symbol}`} className="min-h-11 rounded-full bg-[#d7e36a] px-4 text-sm font-semibold text-black" />
            <FillButton mint={open.id} usd={spend} side="sell" price={open.price ?? 0} symbol={open.symbol} label={`Sell $${spend} ${open.symbol}`} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
