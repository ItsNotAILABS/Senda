import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { loadTape, liveMarks, searchTape, bookStat, type TapeCoin } from "@/lib/jup-tape";
import { getEquityBook, listedMarks } from "@/lib/equities";
import { WORLD } from "@/lib/world-book";
import { connectWallet, detectWallets, type WalletId } from "@/lib/wallets";
import { isPhoneBrowser, insideWalletApp, openInWallet } from "@/lib/mobile-wallet";
import { payUsdc } from "@/lib/solana-pay";
import { connectPhantom, mintDecimals, splHolding } from "@/lib/phantom";
import { quoteRoute, signRoute, PAY, SOL, payAsset, payRaw } from "@/lib/jup-sign";
import { currentIntent, setIntent as setBucket } from "@/lib/book";
import { LiveChart } from "@/components/price-chart";
import { FillCard } from "@/components/fill-card";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const CHIPS = [10, 25, 100, 500];
type Lane = "all" | "movers" | "watch" | "spot" | "pre" | "x" | "sol" | "metal";

export function JupBoard({ names }: { names: HouseListing[] }) {
  const [usd, setUsd] = useState(25);
  const [pay, setPay] = useState("USDC");
  return (
    <div className="pb-8">
      <header className="px-4 pt-2">
        <p className="text-sm text-muted">Spot · Jupiter</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">Fill on the live book</h2>
        <p className="mt-2 text-sm text-muted">
          Phantom signs the swap. Pay with USDC, SOL, CASH, USDT, or PYUSD. The token lands in the wallet.
        </p>
      </header>
      <div className="mt-3 flex gap-1 overflow-x-auto px-4">
        {PAY.map((row) => (
          <button key={row.symbol} type="button" onClick={() => setPay(row.symbol)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold", pay === row.symbol ? "bg-white text-black" : "bg-elevated text-muted")}>
            {row.symbol}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1 px-4">
        {CHIPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setUsd(n)}
            className={cn(
              "min-h-11 flex-1 rounded-full text-sm font-semibold",
              usd === n ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            ${n}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-border px-3">
        {names.map((s) => (
          <JupRow key={s.id} stock={s} usd={usd} pay={pay} />
        ))}
      </ul>
    </div>
  );
}

export function JupRow({ stock, usd, pane, pay = "USDC" }: { stock: HouseListing; usd: number; pane?: boolean; pay?: string }) {
  const wallet = useWallet();
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [solUsd, setSolUsd] = useState(0);
  useEffect(() => {
    let live = true;
    liveMarks({ data: [SOL] })
      .then((marks) => live && setSolUsd(marks[SOL]?.usd || 0))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!stock.mint || !(usd > 0)) return;
    let live = true;
    const asset = payAsset(pay);
    mintDecimals(stock.mint)
      .then((dec) => quoteRoute({ inputMint: asset.mint, outputMint: stock.mint, amountRaw: payRaw(asset.symbol, usd, solUsd), outDecimals: dec }))
      .then((q) => live && setOut(q.outUi > 0 ? q.outUi.toLocaleString("en-US", { maximumFractionDigits: 6 }) : ""))
      .catch(() => live && setOut(""));
    return () => {
      live = false;
    };
  }, [stock.mint, usd, pay, solUsd]);

  async function buy() {
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const kept = wallet.linkChain(owner, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const asset = payAsset(pay);
      if (stock.mint === asset.mint) throw new Error(`That is already ${asset.symbol}. Pick another asset to pay with.`);
      const dec = await mintDecimals(stock.mint);
      const done = await signRoute({
        owner,
        inputMint: asset.mint,
        outputMint: stock.mint,
        amountRaw: payRaw(asset.symbol, usd, solUsd),
        outDecimals: dec,
        usd,
        symbol: stock.symbol,
        extraMints: [asset.mint],
      });
      toast.success(`${stock.symbol} signed. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    } finally {
      setBusy(false);
    }
  }

  if (pane) {
    return (
      <div className="px-6 pb-4">
        <p className="text-sm text-muted">{out ? `About ${out} ${stock.symbol}` : "No quote at this size."}</p>
        <button type="button" disabled={busy} onClick={() => void buy()} className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-50">
          {busy ? "Signing" : `Buy $${usd}`}
        </button>
      </div>
    );
  }
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{stock.symbol}</span>
        <span className="block truncate text-xs text-muted">{stock.name}</span>
      </span>
      <span className="font-mono text-sm tabular-nums">{formatUsd(stock.last)}</span>
      <button type="button" disabled={busy} onClick={() => void buy()} className="min-h-10 rounded-full bg-[#d7e36a] px-3 text-sm font-semibold text-black disabled:opacity-50">
        {busy ? "…" : out ? `Buy · ${out}` : `Buy $${usd}`}
      </button>
    </li>
  );
}

export function TradeBuy({ names, startLane = "movers" }: { names: HouseListing[]; startLane?: Lane }) {
  return <CoinTape names={names} startLane={startLane} />;
}

const SIZES = [0.01, 0.1, 1, 5, 25];
const WATCH = "senda.tape.watch";

function readWatch(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(WATCH) || "[]") as string[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function CoinTape({ names = [], startLane = "movers" }: { names?: HouseListing[]; startLane?: Lane }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<TapeCoin[]>([]);
  const [pick, setPick] = useState("");
  const chartRef = useRef<HTMLElement>(null);
  const [amt, setAmt] = useState("25");
  const [pay, setPay] = useState("USDC");
  const usd = Number(amt);
  const size = Number.isFinite(usd) && usd > 0 ? usd : 0;
  const [out, setOut] = useState("");
  const [via, setVia] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [lane, setLane] = useState<Lane>(startLane);
  const [cap, setCap] = useState(100);
  const [shares, setShares] = useState<TapeCoin[]>([]);
  const [found, setFound] = useState<TapeCoin[]>([]);
  const [marks, setMarks] = useState<Record<string, { usd: number; chg: number }>>({});
  const [watch, setWatch] = useState<string[]>(() => readWatch());
  const [intent, setIntent] = useState<"buy" | "sell" | "send" | null>(null);
  const [held, setHeld] = useState(0);
  const [sendTo, setSendTo] = useState("");
  const [fill, setFill] = useState<{ side: "buy" | "sell" | "send"; sig: string; out: number } | null>(null);
  const [bucket, setBucketState] = useState<"hold" | "trade">("hold");
  useEffect(() => {
    const next = currentIntent();
    if (next === "hold" || next === "trade") setBucketState(next);
  }, []);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("senda.tape.pick") || "";
      if (saved) setPick(saved);
    } catch {
      /* The book still opens on the first name. */
    }
  }, []);
  useEffect(() => {
    if (!pick) return;
    try {
      window.localStorage.setItem("senda.tape.pick", pick);
    } catch {
      /* The pick still lives for this visit. */
    }
  }, [pick]);

  useEffect(() => {
    let live = true;
    loadTape()
      .then((list) => {
        if (!live) return;
        setRows(list);
        if (list[0]) setPick((id) => id || list[0].id);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const liveIds = useRef({ rows, shares, names, pick });
  liveIds.current = { rows, shares, names, pick };
  useEffect(() => {
    let live = true;
    const pull = async () => {
      const cur = liveIds.current;
      const ids = [
        cur.pick,
        ...cur.rows.slice(0, 20).map((r) => r.id),
        ...cur.shares.slice(0, 16).map((r) => r.id),
        ...cur.names.map((n) => n.mint),
        ...WORLD.map((a) => a.mint),
      ].filter((id) => id.length >= 32);
      const unique = [...new Set(ids)].slice(0, 80);
      if (!unique.length) return;
      const next: Record<string, { usd: number; chg: number }> = {};
      for (let i = 0; i < unique.length; i += 40) {
        const part = await liveMarks({ data: unique.slice(i, i + 40) }).catch(() => ({} as Record<string, { usd: number; chg: number }>));
        Object.assign(next, part);
      }
      if (live && Object.keys(next).length) setMarks((prev) => ({ ...prev, ...next }));
    };
    const start = window.setTimeout(() => void pull(), 1200);
    const id = window.setInterval(() => void pull(), 8_000);
    return () => {
      live = false;
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let live = true;
    getEquityBook()
      .then(async (book) => {
        const mints = book.stocks.map((s) => s.mint).filter(Boolean);
        const marks: Record<string, number> = {};
        for (let i = 0; i < mints.length; i += 30) {
          const part = await listedMarks({ data: mints.slice(i, i + 30) }).catch(() => ({} as Record<string, number>));
          Object.assign(marks, part);
        }
        if (!live) return;
        setShares(
          book.stocks.map((s) => ({
            id: s.mint,
            symbol: s.symbol,
            name: s.name || s.symbol,
            price: marks[s.mint] || 0,
            change: 0,
            icon: s.logo || "",
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

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

  const pre: TapeCoin[] = names
    .filter((n) => n.venue === "prestocks" && n.mint)
    .map((n) => ({ id: n.mint, symbol: n.symbol, name: n.name, price: n.last, change: n.change24h ?? 0, icon: n.image }));
  const seenIds = new Set<string>();
  const spots: TapeCoin[] = WORLD.map((asset) => ({
    id: asset.mint,
    symbol: asset.symbol,
    name: `${asset.name} · ${asset.via}. ${asset.note}`,
    price: 0,
    change: 0,
    icon: `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${asset.mint}/logo.png`,
  }));
  const metalMints = new Set(WORLD.filter((asset) => asset.lane === "metals").map((asset) => asset.mint));
  const everything: TapeCoin[] = [...shares, ...pre, ...rows, ...found, ...spots]
    .filter((r) => (r.id && !seenIds.has(r.id) ? (seenIds.add(r.id), true) : false))
    .map((r) => {
      const mark = marks[r.id];
      return mark ? { ...r, price: mark.usd, change: mark.chg || r.change } : r;
    });
  const book = lane === "x" ? shares : lane === "pre" ? pre : lane === "metal" ? everything.filter((r) => metalMints.has(r.id)) : everything;
  const seen = new Set<string>();
  const unique = book.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  const needle = q.trim().toLowerCase();
  const pool = unique.filter((r) => !needle || `${r.symbol} ${r.name}`.toLowerCase().includes(needle));
  const shown =
    lane === "watch"
      ? everything.filter((r) => watch.includes(r.id) && (!needle || `${r.symbol} ${r.name}`.toLowerCase().includes(needle)))
      : lane === "sol"
        ? [...pool.filter((r) => /sol/i.test(`${r.symbol} ${r.name}`)), ...pool.filter((r) => !/sol/i.test(`${r.symbol} ${r.name}`))]
        : lane === "movers"
          ? [...pool].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          : pool;
  const coin = shown.find((r) => r.id === pick) ?? shown[0];
  const page = shown.slice(0, cap);
  const mint = coin?.id ?? "";
  const solUsd = marks[SOL]?.usd || 0;

  useEffect(() => {
    if (!mint || !(size > 0)) return;
    let live = true;
    setOut("");
    setVia("");
    mintDecimals(mint)
      .then((dec) => {
        const asset = payAsset(pay);
        return quoteRoute({ inputMint: asset.mint, outputMint: mint, amountRaw: payRaw(asset.symbol, size, solUsd), outDecimals: dec });
      })
      .then((quoted) => {
        if (!live) return;
        setOut(quoted.outUi > 0 ? quoted.outUi.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "");
        const hit = quoted.impact > 0 ? ` · ${quoted.impact.toFixed(2)}% impact` : "";
        setVia(`${quoted.route}${hit}`);
      })
      .catch((error) => {
        if (!live) return;
        setOut("");
        setVia(error instanceof Error ? error.message : "");
      });
    return () => {
      live = false;
    };
  }, [mint, size, pay, solUsd]);

  useEffect(() => {
    if (!owner || !mint) {
      setHeld(0);
      return;
    }
    let live = true;
    splHolding(owner, mint)
      .then((bag) => live && setHeld(bag.ui))
      .catch(() => live && setHeld(0));
    return () => {
      live = false;
    };
  }, [owner, mint, fill]);

  function star(id: string) {
    setWatch((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
      window.localStorage.setItem(WATCH, JSON.stringify(next));
      return next;
    });
  }

  async function trade(side: "buy" | "sell") {
    if (!coin) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const kept = wallet.linkChain(who, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const asset = payAsset(pay);
      const dec = await mintDecimals(coin.id);
      const selling = side === "sell";
      if (selling && !(coin.price > 0)) throw new Error("No price on this coin.");
      if (!selling && coin.id === asset.mint) throw new Error(`That is already ${asset.symbol}. Pick another asset to pay with.`);
      const amountRaw = selling ? Math.max(1, Math.round((size / coin.price) * 10 ** dec)) : payRaw(asset.symbol, size, marks[SOL]?.usd || 0);
      const done = await signRoute({
        owner: who,
        inputMint: selling ? coin.id : asset.mint,
        outputMint: selling ? asset.mint : coin.id,
        amountRaw,
        outDecimals: selling ? asset.decimals : dec,
        usd: size,
        symbol: coin.symbol,
        qty: selling ? size / coin.price : undefined,
        extraMints: [asset.mint],
      });
      setIntent(null);
      setFill({ side, sig: done.signature, out: done.outUi });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const to = sendTo.trim();
    if (!to) {
      toast.error("Paste the address that should receive it.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const kept = wallet.linkChain(who, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const done = await payUsdc({ owner: who, to, usd: size, memo: coin ? `Senda ${coin.symbol}` : "Senda" });
      setIntent(null);
      setFill({ side: "send", sig: done.signature, out: size });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The send did not sign.");
    } finally {
      setBusy(false);
    }
  }

  if (!coin) return <p className="px-4 pt-4 text-sm text-white/45">{lane === "watch" ? "Nothing starred yet." : lane === "x" ? "Reading every listed share." : "Waiting on Jupiter."}</p>;
  const chg = coin.change;
  const px = coin.price >= 1000 ? `$${coin.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : coin.price >= 1 ? `$${coin.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : coin.price > 0 ? `$${coin.price.toPrecision(4)}` : "—";
  const position = held > 0 ? `${held.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${coin.symbol}` : "No open position";
  const positionUsd = held > 0 && coin.price > 0 ? ` · $${(held * coin.price).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "";
  return (
    <div className="space-y-3 px-3 pt-3 pb-8">
      {fill ? (
        <FillCard
          title={fill.side === "buy" ? `Bought ${coin.symbol}` : fill.side === "send" ? "Sent USDC" : `Sold ${coin.symbol}`}
          symbol={coin.symbol}
          amount={`$${size || 0}`}
          paid={fill.side === "sell" ? coin.symbol : `$${size || 0} ${pay}`}
          received={fill.side === "buy" ? (fill.out > 0 ? `${fill.out.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${coin.symbol}` : coin.symbol) : fill.side === "send" ? sendTo.trim() : `$${size || 0} ${pay}`}
          where="Phantom"
          when="Just now"
          sig={fill.sig}
          onDone={() => setFill(null)}
        />
      ) : null}
      <section ref={chartRef} className="overflow-hidden rounded-2xl border border-white/10 bg-[#12141a]">
        <div className="flex items-center gap-3 px-4 pt-4">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white text-[11px] font-semibold text-black">
            {coin.symbol.slice(0, 2)}
            {coin.icon ? <img src={coin.icon} alt="" className="absolute inset-0 size-10 rounded-full bg-white object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight">{coin.symbol.toUpperCase()}</h2>
              <span className={cn("font-mono text-sm tabular-nums", chg < 0 ? "text-[#ff5d73]" : "text-[#3dd68c]")}>
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(2)}%
              </span>
            </div>
            <p className="truncate text-xs text-white/40">{coin.name}</p>
          </div>
          <p className="font-mono text-xl tabular-nums tracking-tight">{px}</p>
          <span className="size-1.5 shrink-0 rounded-full bg-[#3dd68c]" title="Price updates every few seconds" />
        </div>
        <div className="border-t border-white/10 px-1 py-2">
          <LiveChart
            mint={coin.id}
            symbol={coin.symbol}
            live={coin.price}
            trade={{
              amount: amt,
              setAmount: setAmt,
              busy,
              quote: out ? `About ${out} ${coin.symbol}` : "",
              position: `${position}${positionUsd}`,
              filled: fill ? `${fill.side === "buy" ? "Bought" : fill.side === "sell" ? "Sold" : "Sent"} · ${fill.sig.slice(0, 8)}` : "",
              bucket,
              setBucket: (next) => {
                setBucket(next);
                setBucketState(next);
              },
              onBuy: () => void trade("buy"),
              onSell: () => void trade("sell"),
            }}
          />
        </div>
        {(coin.volume || coin.liquidity || coin.mcap || coin.holders) ? (
          <div className="grid grid-cols-4 gap-1 px-3 pb-2 text-center">
            <div><p className="text-[10px] text-white/35">24h vol</p><p className="font-mono text-[11px]">{bookStat(coin.volume)}</p></div>
            <div><p className="text-[10px] text-white/35">Liquidity</p><p className="font-mono text-[11px]">{bookStat(coin.liquidity)}</p></div>
            <div><p className="text-[10px] text-white/35">Mkt cap</p><p className="font-mono text-[11px]">{bookStat(coin.mcap)}</p></div>
            <div><p className="text-[10px] text-white/35">Holders</p><p className="font-mono text-[11px]">{coin.holders ? coin.holders.toLocaleString("en-US") : "—"}</p></div>
          </div>
        ) : null}
        <p className="px-4 pt-2 text-xs text-white/55">Open · {position}{positionUsd}</p>
        <div className="space-y-3 border-t border-white/10 px-4 py-4">
          <label className="block">
            <span className="text-[11px] tracking-wide text-white/40 uppercase">Amount · dollars of {pay}</span>
            <input
              inputMode="decimal"
              value={amt}
              onChange={(e) => {
                const next = e.target.value.replace(/[^0-9.]/g, "");
                if ((next.match(/\./g) || []).length > 1) return;
                setAmt(next);
              }}
              className="mt-1 w-full bg-transparent font-mono text-3xl tabular-nums outline-none"
            />
          </label>
          <p className="text-sm text-white/55">{out ? `About ${out} ${coin.symbol}` : "No quote at this size."}</p>
          {via ? <p className="text-[11px] text-white/40">Best route · {via}</p> : null}
          <div className="flex gap-1.5 overflow-x-auto">
            {SIZES.map((n) => (
              <button key={n} type="button" onClick={() => setAmt(String(n))} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs", size === n ? "bg-white text-black" : "bg-white/5 text-white/60")}>
                ${n}
              </button>
            ))}
            <button type="button" onClick={() => star(coin.id)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs", watch.includes(coin.id) ? "bg-white text-black" : "bg-white/5 text-white/60")}>
              {watch.includes(coin.id) ? "Watching" : "Watch"}
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {PAY.map((row) => (
              <button key={row.symbol} type="button" onClick={() => setPay(row.symbol)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", pay === row.symbol ? "bg-white text-black" : "bg-white/5 text-white/60")}>
                {row.symbol}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {(
              [
                ["phantom", "Phantom"],
                ["backpack", "Backpack"],
                ["coinbase-sol", "Coinbase"],
                ["metamask", "MetaMask"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const pick = id === "coinbase-sol" && !detectWallets().some((w) => w.id === "coinbase-sol" && w.installed) && detectWallets().some((w) => w.id === "coinbase" && w.installed) ? "coinbase" : id;
                  if (pick === "coinbase-sol" && !detectWallets().some((w) => w.id === "coinbase-sol" && w.installed) && isPhoneBrowser() && !insideWalletApp()) {
                    openInWallet("coinbase");
                    toast.success("Opening Coinbase Wallet. Tap Coinbase again once this page is inside it.");
                    return;
                  }
                  void connectWallet(pick as WalletId)
                    .then((got) => {
                      const kind = got.chain === "evm" ? "evm" : id === "phantom" ? "phantom" : "solana";
                      wallet.linkChain(got.address, got.label, kind);
                      toast.success(got.chain === "evm" ? `${got.label} is on for the EVM desks. A Solana buy signs in Phantom, Backpack, Solflare, or Coinbase.` : `${got.label} signs the next buy.`);
                    })
                    .catch((err) => toast.error(err instanceof Error ? err.message : "That wallet is not in this browser."));
                }}
                className="min-h-8 shrink-0 rounded-full bg-white/5 px-3 text-xs text-white/80"
              >
                {label}
              </button>
            ))}
            <Link to="/revolut" className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-white/5 px-3 text-xs text-white/80">
              Revolut
            </Link>
          </div>
          {intent ? (
            <div className="rounded-xl bg-black/30 p-3">
              <p className="text-sm text-white/80">
                {intent === "send" ? `Send $${size || 0} USDC` : `${intent === "sell" ? "Sell" : "Buy"} ${coin.symbol} · $${size || 0} ${pay}`}
                {intent !== "send" && out ? ` · about ${out} ${intent === "sell" ? pay : coin.symbol}` : ""}
              </p>
              {intent === "send" ? (
                <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="Solana address" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
              ) : (
                <p className="mt-1 text-xs text-white/40">Last {px}. The wallet you chose signs this.</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setIntent(null)} className="min-h-11 rounded-xl border border-white/15 text-sm">Cancel</button>
                <button type="button" disabled={busy} onClick={() => void (intent === "send" ? send() : trade(intent))} className="min-h-11 rounded-xl bg-white text-sm font-semibold text-black disabled:opacity-50">
                  {busy ? "Signing" : "Sign"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button type="button" disabled={busy} onClick={() => void trade("buy")} className="min-h-12 rounded-xl bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-50">Buy ${size || 0}</button>
              <button type="button" disabled={busy} onClick={() => void trade("sell")} className="min-h-12 rounded-xl bg-[#2a1218] text-sm font-semibold text-[#ff8fa0] disabled:opacity-50">Sell ${size || 0}</button>
              <button type="button" onClick={() => setIntent("send")} className="min-h-12 rounded-xl border border-white/15 text-sm font-semibold">Send</button>
            </div>
          )}
        </div>
      </section>
      <input value={q} onChange={(e) => { setQ(e.target.value); setCap(100); }} placeholder="Search every coin" className="min-h-11 w-full rounded-2xl border border-white/10 bg-[#12141a] px-4 text-sm outline-none placeholder:text-white/30" />
      <div className="flex gap-1 overflow-x-auto border-b border-white/10">
        {(
          [
            ["movers", "Movers"],
            ["watch", "Watch"],
            ["spot", "Spot"],
            ["pre", "PreStocks"],
            ["x", "xStocks"],
            ["sol", "Solana"],
            ["metal", "Metals"],
            ["all", `All ${everything.length || ""}`.trim()],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setLane(id); setIntent(null); setCap(100); }} className={cn("min-h-10 shrink-0 border-b-2 px-3 text-sm", lane === id ? "border-white font-semibold text-white" : "border-transparent text-white/45")}>
            {label}
          </button>
        ))}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-white/10 bg-[#12141a]">
        <li className="flex items-center gap-3 px-3 py-2 text-[10px] tracking-wide text-white/35 uppercase">
          <span className="size-9 shrink-0" />
          <span className="flex-1">Name</span>
          <span className="w-16 text-right">Last</span>
          <span className="w-14 text-right">24h</span>
        </li>
        {page.map((r) => {
          const n = r.change;
          const price = r.price >= 1000 ? `$${r.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : r.price >= 1 ? `$${r.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : r.price > 0 ? `$${r.price.toPrecision(3)}` : "—";
          const picked = coin.id === r.id;
          return (
            <li key={r.id} className={cn("border-t border-white/[0.06] first:border-t-0", picked && "bg-white/[0.04]")}>
              <button type="button" onClick={() => { setPick(r.id); setIntent(null); chartRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[#1c1f28] text-[10px] font-semibold text-white/70">
                  {r.symbol.slice(0, 2)}
                  {r.icon ? <img src={r.icon} alt="" className="absolute inset-0 size-9 rounded-full bg-white object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.symbol.toUpperCase()}</span>
                  <span className="block truncate text-[11px] text-white/35">{r.name}</span>
                </span>
                <span className="shrink-0 text-right font-mono text-sm tabular-nums">{price}</span>
                <span className={cn("w-14 shrink-0 text-right font-mono text-xs tabular-nums", n < 0 ? "text-[#ff5d73]" : "text-[#3dd68c]")}>{n >= 0 ? "+" : ""}{n.toFixed(1)}%</span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length > page.length ? (
        <button type="button" onClick={() => setCap((n) => n + 100)} className="min-h-11 w-full rounded-2xl border border-white/10 text-sm font-semibold">
          {page.length.toLocaleString("en-US")} of {shown.length.toLocaleString("en-US")}. Show more
        </button>
      ) : (
        <p className="text-center text-xs text-white/40">{shown.length.toLocaleString("en-US")} on this book. Search reaches the rest of Jupiter too.</p>
      )}
    </div>
  );
}

