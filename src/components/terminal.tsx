import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { coinPx, useCoins } from "@/components/coin-ticker";
import { getStockFlow } from "@/lib/stock-flow";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute, signRoute, signStockSwap } from "@/lib/jup-sign";
import { connectPhantom, signSerializedTx } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { loadBackpack } from "@/lib/backpack";
import { derivBook, type DerivRow } from "@/lib/deriv-book";
import { buildPerpIncrease, executePerpTx } from "@/lib/jup-venues";
import { openBase } from "@/lib/open-base";
import { shortBook } from "@/lib/short-market";
import { connectWallet } from "@/lib/wallets";
import { getHouse, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { holdTrade } from "@/lib/offline-rail";
import { rememberTrade } from "@/lib/trade-log";
import { DeskBots } from "@/components/desk-bots";
import { MarketBrief } from "@/components/market-brief";
import { PackDesk } from "@/components/pack-desk";
import { PrintChart } from "@/components/print-chart";
import { PrintTape } from "@/components/print-tape";
import { DepthScreen } from "@/components/depth-screen";
import { TradeTools } from "@/components/trade-tools";
import { SessionLine, VolumeBook } from "@/components/volume-book";
import { WeekCalendar } from "@/components/week-calendar";
import { ShortActions } from "@/components/short-actions";
import { RestTicket } from "@/components/rest-ticket";
import { cn } from "@/lib/utils";

type Book = "Spot" | "PreStocks" | "xStocks" | "Shares" | "World";

type Leg = {
  key: string;
  book: Book;
  symbol: string;
  name: string;
  mint: string;
  price: number | null;
  change: number | null;
  note: string;
  decimals: number;
  volume: number;
  bid: number | null;
  ask: number | null;
  avantis: string | null;
};

const SIZES = [0.01, 0.1, 1, 5, 25] as const;
const WATCH_KEY = "senda.watch.v1";

function loadWatch(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(WATCH_KEY) || "[]") as string[];
    return Array.isArray(raw) ? raw.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function worldLeg(row: DerivRow): Leg {
  return {
    key: `world:${row.id}`,
    book: "World",
    symbol: row.base,
    name: `${row.base}/${row.quote}`,
    mint: row.hold?.mint || "",
    price: row.mid ?? row.spot,
    change: null,
    note: row.lane,
    decimals: 6,
    volume: row.oi || 0,
    bid: row.bid,
    ask: row.ask,
    avantis: row.avantis,
  };
}

function vol(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function qty(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

/** The main ticket. Movers leads with every book. The list is the page, not a short box. */
export function Terminal({ lane = "trade", onLane }: { lane?: "trade" | "solana"; onLane?: (next: "trade" | "solana") => void }) {
  const wallet = useWallet();
  const coins = useCoins();
  const [names, setNames] = useState<HouseListing[]>([]);
  const [stocks, setStocks] = useState<Leg[]>([]);
  const [shares, setShares] = useState<Leg[]>([]);
  const [world, setWorld] = useState<Leg[]>([]);
  const [book, setBook] = useState<Book | "All" | "Watch" | "Packs" | "Shorts">("All");
  const [view, setView] = useState<"chart" | "book" | "depth" | "volume" | "session">("chart");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [raw, setRaw] = useState("25");
  const [watch, setWatch] = useState<string[]>(loadWatch);
  const [busy, setBusy] = useState("");
  const [review, setReview] = useState<"" | "buy" | "sell" | "short">("");
  const [rest, setRest] = useState(false);
  const [live, setLive] = useState<Record<string, { price: number; change: number; at: number }>>({});
  const [got, setGot] = useState("");
  const [stage, setStage] = useState(false);
  const usd = Number(raw);

  useEffect(() => {
    let on = true;
    getHouse()
      .then((rows) => { if (on) setNames(rows.filter((n) => n.venue === "prestocks" && n.last > 0 && n.mint)); })
      .catch(() => undefined);
    getStockFlow()
      .then((rows) => {
        if (!on) return;
        setStocks(rows.map((s) => ({
          key: s.mint,
          book: "xStocks" as const,
          symbol: s.symbol,
          name: s.name,
          mint: s.mint,
          price: s.price,
          change: s.change,
          note: s.kind,
          decimals: s.decimals,
          volume: s.volume,
          bid: null,
          ask: null,
          avantis: null,
        })));
      })
      .catch(() => undefined);
    loadBackpack()
      .then((rows) => {
        if (!on) return;
        setShares(rows.filter((s) => s.price > 0).map((s) => ({
          key: s.mint,
          book: "Shares" as const,
          symbol: s.symbol,
          name: s.name,
          mint: s.mint,
          price: s.price,
          change: s.change,
          note: "Backpack",
          decimals: s.decimals,
          volume: s.volume,
          bid: null,
          ask: null,
          avantis: null,
        })));
      })
      .catch(() => undefined);
    derivBook()
      .then((rows) => {
        if (!on) return;
        setWorld(rows.filter((row) => (row.mid ?? row.spot ?? 0) > 0 || row.avantis).map((row) => worldLeg(row)));
      })
      .catch(() => undefined);
    return () => { on = false; };
  }, []);

  const spot = useMemo<Leg[]>(() => coins.filter((c) => c.price > 0).map((c) => ({
    key: c.id,
    book: "Spot" as const,
    symbol: c.symbol,
    name: c.name,
    mint: c.id,
    price: c.price,
    change: c.change,
    note: "",
    decimals: c.decimals,
    volume: 0,
    bid: null,
    ask: null,
    avantis: null,
  })), [coins]);

  const pre = useMemo<Leg[]>(() => names.map((n) => ({
    key: n.mint,
    book: "PreStocks" as const,
    symbol: n.symbol,
    name: n.name,
    mint: n.mint,
    price: n.last,
    change: n.change24h == null ? null : n.change24h * 100,
    note: n.sector || "",
    decimals: 6,
    volume: n.liquidity || 0,
    bid: null,
    ask: null,
    avantis: null,
  })), [names]);

  const legs = useMemo(() => {
    const query = q.trim().toLowerCase();
    const paint = (row: Leg): Leg => {
      const hit = live[row.mint];
      return hit ? { ...row, price: hit.price, change: hit.change } : row;
    };
    const all = [...spot, ...pre, ...stocks, ...shares, ...world];
    const shorts = all.filter((row, i) => (row.avantis || shortBook(row.symbol)) && all.findIndex((other) => other.symbol.toUpperCase() === row.symbol.toUpperCase()) === i);
    let rows: Leg[] = book === "Spot" ? spot
      : book === "PreStocks" ? pre
      : book === "xStocks" ? stocks
      : book === "Shares" ? shares
      : book === "World" ? world
      : book === "Shorts" ? shorts
      : book === "Watch" ? all.filter((row) => watch.includes(row.key))
      : [...all].sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0) || b.volume - a.volume);
    if (query) rows = rows.filter((row) => `${row.symbol} ${row.name} ${row.book}`.toLowerCase().includes(query));
    return rows.map(paint);
  }, [book, spot, pre, stocks, shares, world, watch, q, live]);

  const leg = legs.find((row) => row.key === pick) ?? legs[0] ?? null;
  const mintKey = legs.slice(0, 40).map((row) => row.mint).join(",");

  useEffect(() => {
    if (!mintKey) return;
    let on = true;
    const pull = () => {
      void fetch(`https://lite-api.jup.ag/price/v3?ids=${mintKey}`, { headers: { accept: "application/json" } })
        .then((res) => res.json())
        .then((body: Record<string, { usdPrice?: number; priceChange24h?: number }>) => {
          if (!on || !body) return;
          const next: Record<string, { price: number; change: number; at: number }> = {};
          for (const [mint, row] of Object.entries(body)) {
            const price = Number(row?.usdPrice) || 0;
            if (price > 0) next[mint] = { price, change: Number(row.priceChange24h) || 0, at: Date.now() };
          }
          if (Object.keys(next).length) setLive((cur) => ({ ...cur, ...next }));
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 2_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [mintKey]);

  useEffect(() => {
    if (!leg || !(usd > 0)) {
      setGot("");
      return;
    }
    const atoms = Math.round(usd * 1e6);
    if (atoms < 1) {
      setGot("Under one millionth of a dollar.");
      return;
    }
    let on = true;
    const timer = window.setTimeout(() => {
      const selling = review === "sell" && (leg.price ?? 0) > 0;
      const amountRaw = selling ? Math.max(1, Math.round((usd / (leg.price as number)) * 10 ** leg.decimals)) : atoms;
      void quoteRoute({
        inputMint: selling ? leg.mint : USDC,
        outputMint: selling ? USDC : leg.mint,
        amountRaw,
        outDecimals: selling ? 6 : leg.decimals,
      })
        .then((quote) => {
          if (!on) return;
          const screen = leg.price ?? 0;
          const executed = quote.outUi > 0 ? (selling ? usd / quote.outUi : usd / quote.outUi) : 0;
          const vs = screen > 0 && executed > 0 && !selling ? ` · fill ${((executed - screen) / screen * 100).toFixed(2)}% vs screen` : "";
          setGot(selling ? `You get $${quote.outUi.toFixed(6)} USDC` : `You get ${qty(quote.outUi)} ${leg.symbol}${vs}`);
        })
        .catch(() => {
          if (on) setGot("No quote at this size.");
        });
    }, 350);
    return () => {
      on = false;
      window.clearTimeout(timer);
    };
  }, [leg, usd, review]);

  async function signer(): Promise<string> {
    const have = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    const who = have || (await connectPhantom());
    if (!have) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Phantom.");
    }
    return who;
  }

  async function trade(side: "buy" | "sell" | "short", row?: Leg) {
    const name = row ?? leg;
    if (!name) return;
    if (!(usd > 0) || Math.round(usd * 1e6) < 1) {
      toast.error("That is under one millionth of a dollar.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const listed = shortBook(name.symbol);
      if (side === "short" && (listed || name.avantis)) {
        toast.error("That short needs the network. It was not held.");
        return;
      }
      if (side === "short") {
        toast.error("No short market on this name. A sell is not a short.");
        return;
      }
      const held = holdTrade({
        kind: "spot",
        mint: name.mint,
        symbol: name.symbol,
        side,
        usd,
        sol: 0,
        pool: "auto",
        price: name.price ?? 0,
        decimals: name.decimals,
      });
      toast.success("error" in held ? held.error : `${name.symbol} is held on this phone. It signs when the network is back.`);
      setReview("");
      return;
    }
    setBusy(side);
    let ok = false;
    try {
      const who = await signer();
      const listed = shortBook(name.symbol);
      const asset = listed?.kind === "jup" ? listed.asset : null;
      const pair = name.avantis || (listed?.kind === "base" ? listed.pair : null);
      if (side === "short" && asset) {
        if (usd < 10) throw new Error("Jupiter asks for at least $10 of collateral on a short.");
        const built = await buildPerpIncrease({ data: { owner: who, asset, side: "short", usd, leverage: 2 } });
        const signed = await signSerializedTx(built.tx);
        const done = await executePerpTx({ data: { action: "increase-position", serializedTxBase64: signed } });
        rememberTrade({ symbol: name.symbol, side: "sell", usd, mint: name.mint, signature: done.txid });
        toast.success(`${name.symbol} short is open at 2×. ${done.txid.slice(0, 8)}…`);
      } else if ((side === "short" || (side === "buy" && !name.mint)) && pair) {
        const have = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
        const trader = have || (await connectWallet("metamask")).address;
        if (!have) {
          const linked = wallet.linkChain(trader, "MetaMask", "evm");
          if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep MetaMask.");
        }
        const opened = await openBase({ trader, pair, side: side === "short" ? "short" : "long", usd });
        toast.success(`${name.symbol} ${side === "short" ? "short" : "long"} signed on Base. ${opened.hash.slice(0, 8)}…`);
      } else if (side === "buy") {
        if (!name.mint) throw new Error("This name has no Solana token. Short signs it on Base.");
        const done = await signStockSwap({ owner: who, mint: name.mint, side: "buy", usd, decimals: name.decimals });
        rememberTrade({ symbol: name.symbol, side, usd, mint: name.mint, signature: done.signature });
        toast.success(`Bought ${qty(done.outUi)} ${name.symbol}. ${done.signature.slice(0, 8)}…`);
      } else if (side === "short") {
        throw new Error("No short market on this name. A sell is not a short.");
      } else if (name.book === "PreStocks" && name.mint) {
        const done = await runPrestock({ owner: who, mint: name.mint, side: "sell", usd, price: name.price ?? undefined });
        rememberTrade({ symbol: name.symbol, side: "sell", usd, mint: name.mint, signature: done.signature });
        toast.success(`Sold ${name.symbol}. ${done.signature.slice(0, 8)}…`);
      } else {
        if (!name.mint) throw new Error("Nothing of this is in a Solana wallet. The short is the Base button.");
        if (!(name.price && name.price > 0)) throw new Error("No price, so the sell cannot be sized.");
        const amountRaw = Math.max(1, Math.round((usd / name.price) * 10 ** name.decimals));
        const done = await signRoute({
          owner: who,
          inputMint: name.mint,
          outputMint: USDC,
          amountRaw,
          outDecimals: 6,
          usd,
        });
        rememberTrade({ symbol: name.symbol, side: "sell", usd, mint: name.mint, signature: done.signature });
        toast.success(`Sold ${name.symbol}. ${done.signature.slice(0, 8)}…`);
      }
      ok = true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy("");
      if (ok) setReview("");
    }
  }

  function star(key: string) {
    setWatch((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [key, ...cur].slice(0, 40);
      try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }

  const ranked = [...legs].filter((row) => row.change != null);
  const gainers = [...ranked].sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 3);
  const losers = [...ranked].sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 3);
  const watched = legs.filter((row) => watch.includes(row.key)).slice(0, 3);

  function open(key: string) {
    setPick(key);
    setStage(false);
    setReview("");
  }

  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0e14] lg:mx-4">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every book" className="min-h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-3 text-sm outline-none" />
        <p className="shrink-0 font-mono text-[11px] text-white/40">{book === "Packs" ? "Packs" : legs.length}</p>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 py-2">
        {(["All", "Watch", "Shorts", "Spot", "PreStocks", "xStocks", "Shares", "World", "Packs"] as const).map((id) => (
          <button key={id} type="button" onClick={() => { setBook(id); setPick(""); onLane?.("trade"); }} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", lane === "trade" && book === id ? "bg-white text-black" : "bg-white/10")}>{id}</button>
        ))}
        <button type="button" onClick={() => onLane?.("solana")} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", lane === "solana" ? "bg-white text-black" : "bg-white/10")}>Solana</button>
      </div>
      <WeekCalendar onOpen={(symbol) => { setBook("All"); setQ(symbol); setPick(""); }} />
      {book === "Packs" ? <PackDesk /> : null}
      {book === "Packs" ? null : <DeskBots names={names} onOpen={open} />}
      <div className="grid gap-2 border-b border-white/10 px-3 py-2 sm:grid-cols-3">
        <Analytic title="Movers up" rows={gainers} onOpen={open} />
        <Analytic title="Movers down" rows={losers} onOpen={open} />
        <Analytic title={`Watching ${watch.length}`} rows={watched} empty="Star a name. It stays on this device." onOpen={open} />
      </div>
      {book === "Packs" ? null : (
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_320px]">
        <ul className="order-2 divide-y divide-white/8 lg:order-1">
          {legs.map((row) => (
            <li key={`${row.book}:${row.key}`}>
              <button type="button" onClick={() => open(row.key)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-3 text-left sm:grid-cols-[1fr_auto_auto_auto_auto]", leg?.key === row.key && "bg-white/[0.04]")}>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{row.symbol}</span>
                  <span className="block truncate text-xs text-subtle">{row.book} · {row.name}</span>
                </span>
                <span className="font-mono text-sm tabular-nums">{row.price != null ? coinPx(row.price) : "—"}</span>
                <span className="hidden font-mono text-[11px] text-white/55 sm:block">{vol(row.volume)}</span>
                <span className={cn("font-mono text-xs", (row.change ?? 0) < 0 ? "text-down" : "text-accent")}>{pct(row.change)}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); star(row.key); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); star(row.key); } }}
                  className={cn("hidden text-xs sm:block", watch.includes(row.key) ? "text-accent" : "text-subtle")}
                >
                  {watch.includes(row.key) ? "★" : "☆"}
                </span>
              </button>
            </li>
          ))}
          {legs.length === 0 ? <li className="px-3 py-6 text-sm text-subtle">Nothing in this book yet.</li> : null}
        </ul>
        <div className="order-1 border-b border-white/10 p-4 lg:order-2 lg:border-b-0 lg:border-l">
          {leg ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-subtle">{leg.book} · {leg.name}</p>
                  <p className="font-mono text-2xl font-semibold tracking-tight">{leg.symbol}</p>
                </div>
                <p className={cn("rounded-lg px-2 py-1 font-mono text-sm", (leg.change ?? 0) < 0 ? "bg-down/15 text-down" : "bg-accent/15 text-accent")}>{pct(leg.change)}</p>
              </div>
              <p className="mt-3 font-mono text-4xl tracking-tight tabular-nums">{leg.price != null ? coinPx(leg.price) : "—"}</p>
              <TradeTools
                symbol={leg.symbol}
                mint={leg.mint}
                price={leg.price ?? 0}
                change={leg.change}
                liquidity={names.find((n) => n.mint === leg.mint)?.liquidity}
                premium={names.find((n) => n.mint === leg.mint)?.premium}
              />
              <div className="mt-3 flex gap-1">
                {(["chart", "book", "depth", "volume", "session"] as const).map((id) => (
                  <button key={id} type="button" onClick={() => setView(id)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold capitalize", view === id ? "bg-white text-black" : "bg-white/10")}>{id}</button>
                ))}
              </div>
              <div className="mt-3">
                {view === "chart" ? (
                  <>
                    {stage ? <button type="button" onClick={() => setStage(false)} className="mb-2 text-xs font-semibold text-white/50">Shorter chart</button> : null}
                    {leg.mint ? <PrintChart mint={leg.mint} symbol={leg.symbol} className={stage ? "h-[70dvh] lg:h-[640px]" : "h-[220px] w-full lg:h-[320px]"} /> : <p className="text-xs text-white/45">No Solana pool for this name.</p>}
                  </>
                ) : null}
                {view === "book" && leg.mint ? <PrintTape mint={leg.mint} symbol={leg.symbol} size={usd} /> : null}
                {view === "depth" && leg.mint ? <DepthScreen mint={leg.mint} symbol={leg.symbol} onBuy={() => setReview("buy")} onSell={() => setReview("sell")} /> : null}
                {view === "volume" ? <VolumeBook mint={leg.mint} bid={leg.bid} ask={leg.ask} mid={leg.price} volume={leg.volume} /> : null}
                {view === "session" ? <SessionLine mint={leg.mint} /> : null}
              </div>
              <label className="mt-3 block">
                <span className="sr-only">Dollars</span>
                <input
                  value={raw}
                  inputMode="decimal"
                  aria-label="Dollars"
                  onChange={(e) => { setRaw(e.target.value.replace(/[^0-9.]/g, "")); setReview(""); }}
                  className="w-full bg-transparent font-mono text-4xl tabular-nums outline-none"
                />
              </label>
              <p className="mt-1 min-h-5 font-mono text-sm text-accent">{got || "Type any amount. Under a cent is allowed."}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {SIZES.map((n) => (
                  <button key={n} type="button" onClick={() => { setRaw(String(n)); setReview(""); }} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", Number(raw) === n ? "bg-white text-black" : "bg-white/10")}>${n}</button>
                ))}
              </div>
              {review ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
                  <p className="text-sm font-semibold">{review === "buy" ? "Buy" : review === "short" ? "Short" : "Sell"} {leg.symbol}</p>
                  <p className="mt-1 font-mono text-2xl tabular-nums">${raw || "0"}</p>
                  <p className="mt-1 font-mono text-sm text-accent">{got || "Waiting for the quote."}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {review === "short" && shortBook(leg.symbol)?.kind === "jup"
                      ? "Market short. Jupiter perp, 2×. Collateral is the dollars. Phantom signs."
                      : review === "short" && (leg.avantis || shortBook(leg.symbol)?.kind === "base")
                        ? `Market short on ${leg.avantis || shortBook(leg.symbol)?.label}. MetaMask on Base, 2×. Not a Solana swap.`
                        : review === "short"
                          ? "No short market on this name. Selling the token is not a short."
                          : "Phantom signs. Nothing moves until it does."}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setReview("")} className="min-h-12 rounded-xl border border-white/15 text-sm font-semibold">Cancel</button>
                    <button type="button" disabled={busy !== ""} onClick={() => void trade(review)} className="min-h-12 rounded-xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">{busy ? "Waiting for Phantom…" : "Sign"}</button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button type="button" disabled={busy !== ""} onClick={() => setReview("buy")} className="min-h-12 rounded-xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">Buy</button>
                  <button type="button" disabled={busy !== ""} onClick={() => setReview("sell")} className="min-h-12 rounded-xl border border-white/15 text-sm font-semibold disabled:opacity-40">Sell</button>
                  <button type="button" disabled={busy !== ""} onClick={() => setReview("short")} className="min-h-12 rounded-xl bg-[#e11d48] text-sm font-semibold text-white disabled:opacity-40">Short</button>
                </div>
              )}
              {!review && rest && leg.mint ? <RestTicket key={leg.mint} mint={leg.mint} symbol={leg.symbol} price={leg.price || 0} usd={usd} side="buy" /> : null}
              {!review ? (
                <button type="button" disabled={!leg.mint} onClick={() => setRest((on) => !on)} className="mt-2 min-h-10 w-full rounded-xl border border-white/15 text-xs font-semibold disabled:opacity-40">
                  {leg.mint ? (rest ? "Hide the limit" : `Rest a limit on ${leg.symbol}`) : "No Solana mint to rest"}
                </button>
              ) : null}
              {review ? null : <ShortActions symbol={leg.symbol} usd={usd} indexOnly />}
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-subtle">Stats and news</summary>
                <div className="mt-3">
                  <MarketBrief
                    symbol={leg.symbol}
                    name={leg.name}
                    mint={leg.mint}
                    price={leg.price}
                    change={leg.change}
                    note={leg.book}
                    image={names.find((n) => n.mint === leg.mint)?.image}
                    stats={[
                      names.find((n) => n.mint === leg.mint)?.mark ? { label: "Mark", value: `$${names.find((n) => n.mint === leg.mint)!.mark.toLocaleString("en-US", { maximumFractionDigits: 2 })}` } : null,
                      names.find((n) => n.mint === leg.mint)?.sector ? { label: "Sector", value: names.find((n) => n.mint === leg.mint)!.sector } : null,
                      (names.find((n) => n.mint === leg.mint)?.holders || 0) > 0 ? { label: "Holders", value: names.find((n) => n.mint === leg.mint)!.holders.toLocaleString("en-US") } : null,
                      (names.find((n) => n.mint === leg.mint)?.liquidity || 0) > 0 ? { label: "Liquidity", value: `$${names.find((n) => n.mint === leg.mint)!.liquidity.toLocaleString("en-US", { maximumFractionDigits: 0 })}` } : null,
                      leg.volume > 0 ? { label: "Volume", value: leg.volume.toLocaleString("en-US", { maximumFractionDigits: 0 }) } : null,
                    ].filter((row): row is { label: string; value: string } => Boolean(row))}
                  />
                </div>
              </details>
            </>
          ) : (
            <p className="text-sm text-subtle">The book has not come back yet.</p>
          )}
        </div>
      </div>
      )}
    </section>
  );
}

function Analytic({ title, rows, empty, onOpen }: { title: string; rows: Leg[]; empty?: string; onOpen: (key: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
      <p className="px-1 text-[10px] tracking-[0.14em] text-white/40 uppercase">{title}</p>
      {rows.length ? (
        <ul className="mt-1">
          {rows.map((row) => (
            <li key={row.key}>
              <button type="button" onClick={() => onOpen(row.key)} className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/5">
                <span className="text-sm font-semibold">{row.symbol}</span>
                <span className={cn("font-mono text-[11px]", (row.change ?? 0) < 0 ? "text-down" : "text-accent")}>{pct(row.change)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-xs text-white/35">{empty || "No print yet."}</p>
      )}
    </div>
  );
}
