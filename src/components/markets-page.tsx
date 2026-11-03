import { useEffect, useState } from "react";
import { jupTape, type TapeRow } from "@/lib/world-book";
import { useHouse } from "@/lib/use-house";
import { FillButton } from "@/components/fill-button";
import { LiveChart } from "@/components/price-chart";
import { MarketIntelligence } from "@/components/market-intelligence";
import { ListedView } from "@/components/desk-views";
import { OstiumBook } from "@/components/ostium-book";
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
import { BasketDesk } from "@/components/basket-desk";
import { CoverDesk } from "@/components/cover-desk";
import { CurveDesk } from "@/components/curve-desk";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { LaunchDesk } from "@/components/launch-desk";
import { LendDesk } from "@/components/lend-desk";
import { PlayDesk } from "@/components/play-desk";
import { RadarDesk } from "@/components/radar-desk";
import { NetBrief, NetworkSheet } from "@/components/network-sheet";
import { PHANTOM_NETS, netMatches } from "@/lib/chain-book";
import { cn } from "@/lib/utils";

type Tab = "intel" | "trending" | "up" | "down" | "names" | "registry" | "futures" | "kalshi" | "poly" | "fx" | "metals" | "comms" | "pairs" | "ostium" | "hl" | "deriv" | "chains" | "vaults" | "products" | "shares" | "perps" | "solana" | "stake" | "basket" | "lend" | "cover" | "radar" | "curve" | "launch" | "rails" | "news";

const TITLES: Record<Tab, string> = {
  intel: "Market Intelligence",
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
  comms: "Commodities",
  pairs: "Pairs",
  ostium: "Ostium",
  hl: "Hyperliquid",
  deriv: "Derivatives",
  chains: "Chains",
  vaults: "Vaults",
  products: "Products",
  shares: "xStocks",
  perps: "Perps",
  solana: "Solana",
  stake: "Stakes",
  basket: "Index",
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

export function MarketsPage() {
  const book = useHouse();
  const house = book.filter((h) => h.venue === "prestocks" && h.last > 0);
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [tab, setTab] = useState<Tab>("trending");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<TapeRow | null>(null);
  const [nameId, setNameId] = useState("");
  const [sort, setSort] = useState<"gain" | "loss" | "price" | "name">("gain");
  const [cap, setCap] = useState(40);
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
  const coins = tape.filter((r) => !query || `${r.symbol} ${r.name}`.toLowerCase().includes(query));
  const shown = (tab === "up" ? coins.filter((r) => (r.change ?? 0) > 0) : tab === "down" ? coins.filter((r) => (r.change ?? 0) < 0) : coins)
    .slice()
    .sort((a, b) => {
      if (sort === "name") return a.symbol.localeCompare(b.symbol);
      if (sort === "price") return (b.price ?? 0) - (a.price ?? 0);
      const av = a.changePct ?? -1e9;
      const bv = b.changePct ?? -1e9;
      return sort === "loss" ? av - bv : bv - av;
    });
  const names = house.filter((h) => (!query || `${h.symbol} ${h.name}`.toLowerCase().includes(query)) && netMatches(net, h.symbol));
  const name = names.find((h) => h.id === nameId) ?? names[0] ?? null;
  const coinsOnNet = shown.filter((r) => netMatches(net, r.symbol));
  const spend = usd > 0 ? usd : 1;

  return (
    <div className="px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Markets</p>
        <h1 className="mt-1 text-3xl tracking-tight">{TITLES[tab]}</h1>
        <p className="mt-1 max-w-xl text-sm text-white/50">
          {coinTab(tab)
            ? shape === "cards"
              ? "Cards is a filter on the coin book. Each square buys and sells in the wallet."
              : "Same coins, as a list. Cards puts the grid back."
            : "This desk stays its own book. Cards jumps back to the coin grid."}
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
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {(
          [
            ["intel", "Intelligence"],
            ["trending", "Coins"],
            ["up", "Up"],
            ["down", "Down"],
            ["names", "Names"],
            ["registry", "Registry"],
            ["futures", "Futures"],
            ["kalshi", "Kalshi"],
            ["poly", "Polymarket"],
            ["fx", "FX"],
            ["metals", "Metals"],
            ["comms", "Commodities"],
            ["pairs", "Pairs"],
            ["ostium", "Ostium"],
            ["hl", "Hyperliquid"],
            ["deriv", "Derivatives"],
            ["chains", "Chains"],
            ["vaults", "Vaults"],
            ["products", "Products"],
            ["shares", "xStocks"],
            ["perps", "Perps"],
            ["solana", "Solana"],
            ["stake", "Stakes"],
            ["basket", "Index"],
            ["lend", "Borrow"],
            ["cover", "Cover"],
            ["radar", "Radar"],
            ["curve", "Curve"],
            ["launch", "Launch"],
            ["rails", "Rails"],
            ["news", "News"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? "min-h-9 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 shrink-0 rounded-full px-3 text-sm text-white/60"}>
            {label}
          </button>
        ))}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setCap(40); }} placeholder="Search" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
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
      {tab === "intel" ? <MarketIntelligence house={book} tape={tape} embedded /> : null}
      {tab === "fx" ? <WorldDesk start="fx" /> : null}
      {tab === "metals" ? <WorldDesk start="metals" /> : null}
      {tab === "comms" ? <CommodityBook /> : null}
      {tab === "pairs" ? <PairBook /> : null}
      {tab === "ostium" ? <OstiumBook /> : null}
      {tab === "hl" ? <HlTicket /> : null}
      {tab === "deriv" ? <DerivDesk /> : null}
      {tab === "chains" ? <ChainDesk /> : null}
      {tab === "vaults" ? <VaultMarket /> : null}
      {tab === "products" ? <div className="mt-3"><OfferingBook /></div> : null}
      {tab === "shares" ? <ListedView view="market" /> : null}
      {tab === "perps" ? (
        <div className="mt-3 space-y-4">
          <PerpDesk />
          <PerpBooks />
        </div>
      ) : null}
      {tab === "solana" ? <SolanaFloor house={book} view="mints" /> : null}
      {tab === "news" ? <DeskNews flush /> : null}
      {tab === "kalshi" ? <KalshiTape /> : null}
      {tab === "poly" ? <PolyTape /> : null}
      {tab === "futures" ? <FdvDesk /> : null}
      {tab === "registry" ? <RegistryDesk /> : null}
      {tab === "stake" ? <PlayDesk house={book} /> : null}
      {tab === "basket" ? <BasketDesk house={house} /> : null}
      {tab === "lend" ? <LendDesk house={house} /> : null}
      {tab === "cover" ? <CoverDesk names={house} view="all" /> : null}
      {tab === "radar" ? <RadarDesk house={house} /> : null}
      {tab === "curve" ? <CurveDesk /> : null}
      {tab === "launch" ? <LaunchDesk /> : null}
      {tab === "rails" ? <EcosystemDesk house={house} /> : null}
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
            {coinsOnNet.slice(0, cap).map((r) => {
              const chg = r.changePct ?? null;
              return (
                <li key={r.id} className="flex min-h-[168px] flex-col rounded-[22px] border border-white/10 bg-[#10131c] p-3">
                  <button type="button" onClick={() => setOpen(r)} className="text-left">
                    {r.icon ? <img src={r.icon} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-white text-[10px] font-semibold text-black">{r.symbol.slice(0, 2)}</span>}
                    <span className="mt-2 block truncate font-semibold">{r.symbol}</span>
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
            {coinsOnNet.length > cap ? (
              <li className="col-span-2">
                <button type="button" onClick={() => setCap((n) => n + 40)} className="min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
                  Show more · {(coinsOnNet.length - cap).toLocaleString("en-US")} still on the book
                </button>
              </li>
            ) : null}
          </ul>
        ) : (
          <ul className="mt-2">
            {coinsOnNet.slice(0, cap).map((r) => {
              const chg = r.changePct ?? null;
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 py-3 text-left">
                    {r.icon ? <img src={r.icon} alt="" className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-white text-xs font-semibold text-black">?</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{r.symbol}</span>
                      <span className="block truncate text-xs text-muted">{r.name}</span>
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
            {coinsOnNet.length > cap ? (
              <li className="py-3">
                <button type="button" onClick={() => setCap((n) => n + 40)} className="min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
                  Show more · {(coinsOnNet.length - cap).toLocaleString("en-US")} still on the book
                </button>
              </li>
            ) : null}
          </ul>
        )
      ) : null}
      {open && coinTab(tab) ? (
        <section className="mt-2 rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-sm font-semibold">{open.symbol}</p>
          <p className="mt-1 text-xs text-muted">{open.name}</p>
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
