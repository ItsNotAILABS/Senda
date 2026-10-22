import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LiveChart } from "@/components/price-chart";
import { jupTape, type TapeRow } from "@/lib/world-book";
import { quoteRoute, signRoute } from "@/lib/jup-sign";
import { useHouse } from "@/lib/use-house";
import { connectPhantom, mintDecimals } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIZES = [0.01, 0.1, 1, 5, 25];
type Lens = "all" | "movers" | "spot" | "pre" | "x";

function pct(change: number | null) {
  if (change == null) return null;
  const n = Math.abs(change) <= 2 ? change * 100 : change;
  return n;
}

type BookRow = TapeRow & { kind: "coin" | "pre" | "x" };

function bookOf(
  rows: TapeRow[],
  house: { mint: string; symbol: string; name: string; last: number; change24h: number | null; image: string; venue: string }[],
): BookRow[] {
  const seen = new Set(rows.map((r) => r.id));
  const extra: BookRow[] = house
    .filter((h) => h.last > 0 && h.mint && !seen.has(h.mint))
    .map((h) => ({
      id: h.mint,
      symbol: h.symbol,
      name: h.name,
      price: h.last,
      change: h.change24h,
      icon: h.image || undefined,
      kind: h.venue === "prestocks" ? "pre" : "x",
    }));
  return [
    ...extra,
    ...rows.map((r): BookRow => ({ ...r, kind: /x$/i.test(r.symbol) ? "x" : "coin" })),
  ];
}

export function CoinBoard({ start = "all" }: { start?: Lens }) {
  const house = useHouse();
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<TapeRow[]>([]);
  const [pick, setPick] = useState<string>("");
  const [usd, setUsd] = useState(25);
  const [out, setOut] = useState<string>("");
  const [busy, setBusy] = useState("");
  const [cap, setCap] = useState(24);
  const [lens, setLens] = useState<Lens>(start);
  const [q, setQ] = useState("");
  const book = useMemo(() => {
    const query = q.trim().toLowerCase();
    return bookOf(rows, house).filter((r) => {
      if (query && !`${r.symbol} ${r.name}`.toLowerCase().includes(query)) return false;
      if (lens === "pre") return r.kind === "pre";
      if (lens === "x") return r.kind === "x";
      if (lens === "spot") return r.kind === "coin";
      if (lens === "movers") return Math.abs(pct(r.change) ?? 0) >= 3;
      return true;
    });
  }, [rows, house, q, lens]);
  const coin = book.find((r) => r.id === pick) ?? book[0] ?? null;

  useEffect(() => {
    let live = true;
    jupTape()
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

  useEffect(() => {
    if (!coin || !(usd > 0)) return;
    let live = true;
    setOut("");
    mintDecimals(coin.id)
      .then((dec) => quoteRoute({ inputMint: USDC, outputMint: coin.id, amountRaw: Math.round(usd * 1_000_000), outDecimals: dec }))
      .then((q) => live && setOut(q.outUi.toLocaleString("en-US", { maximumFractionDigits: 4 })))
      .catch(() => live && setOut(""));
    return () => {
      live = false;
    };
  }, [coin, usd]);

  async function trade(row: BookRow, side: "buy" | "sell") {
    if (!(usd > 0)) return toast.error("Enter a size.");
    setBusy(`${row.id}:${side}`);
    setPick(row.id);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const kept = wallet.linkChain(who, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const dec = await mintDecimals(row.id);
      const done = await signRoute({
        owner: who,
        inputMint: side === "buy" ? USDC : row.id,
        outputMint: side === "buy" ? row.id : USDC,
        amountRaw: Math.round(usd * 1_000_000),
        outDecimals: side === "buy" ? dec : 6,
        usd,
      });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} $${usd} ${row.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  const chg = pct(coin?.change ?? null);
  return (
    <div className="space-y-3 px-3 py-3">
      {coin ? (
        <section className="rounded-[28px] bg-[#101114] px-4 py-4">
          <p className="text-sm text-white/45">{coin.name}</p>
          <div className="flex items-start justify-between">
            <h2 className="text-3xl font-semibold">{coin.symbol}</h2>
            {chg != null ? (
              <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", chg < 0 ? "bg-[#3a1520] text-[#ff5d73]" : "bg-[#1c2a12] text-[#c6f56a]")}>
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(1)}%
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-4xl">{coin.price == null ? "—" : coin.price >= 1 ? `$${coin.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${coin.price.toPrecision(3)}`}</p>
          <div className="mt-3 overflow-hidden rounded-2xl bg-black/40">
            <LiveChart compact mint={coin.id} symbol={coin.symbol} live={coin.price ?? 0} />
          </div>
          <p className="font-mono text-3xl">{usd}</p>
          {out ? <p className="text-sm text-[#d7e36a]">About {out} {coin.symbol}</p> : <p className="text-sm text-[#d7e36a]">No quote at this size.</p>}
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {SIZES.map((n) => (
              <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold", usd === n ? "bg-white text-black" : "bg-[#2a2a2e] text-white")}>
                ${n}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy !== ""} onClick={() => coin && void trade(coin, "buy")} className="min-h-12 rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
              Buy ${usd}
            </button>
            <button type="button" disabled={busy !== ""} onClick={() => coin && void trade(coin, "sell")} className="min-h-12 rounded-full bg-[#e23b4a] text-sm font-semibold text-white">
              Sell ${usd}
            </button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-white/45">Waiting on Jupiter.</p>
      )}
      <div className="flex gap-1 overflow-x-auto">
        {(
          [
            ["all", "All"],
            ["movers", "Movers"],
            ["spot", "Spot"],
            ["pre", "PreStocks"],
            ["x", "xStocks"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setLens(id); setCap(40); }} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", lens === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {label}
          </button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coins, PreStocks, xStocks" className="min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <div className="grid grid-cols-4 gap-3 rounded-[28px] bg-[#101114] px-3 py-4">
        {book.slice(0, 8).map((r) => {
          const n = pct(r.change);
          const on = coin?.id === r.id;
          return (
            <button key={r.id} type="button" onClick={() => setPick(r.id)} className="text-center">
              {r.icon ? (
                <img src={r.icon} alt="" className={cn("mx-auto size-14 rounded-full object-cover", on && "ring-2 ring-[#d7e36a]")} />
              ) : (
                <span className={cn("mx-auto grid size-14 place-items-center rounded-full bg-white text-xs font-semibold text-black", on && "bg-[#d7e36a]")}>{r.symbol.slice(0, 4)}</span>
              )}
              <span className="mt-1 block text-xs font-semibold">{r.symbol.slice(0, 5)}</span>
              <span className={cn("block text-[11px]", n != null && n < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-white/45">{book.length.toLocaleString("en-US")} on this book. Buy and sell are on the card. Phantom signs.</p>
      <ul className="space-y-2">
        {book.slice(0, cap).map((r) => {
          const n = pct(r.change);
          return (
            <li key={r.id} className="rounded-[22px] bg-[#101114] p-3">
              <button type="button" onClick={() => setPick(r.id)} className="flex w-full items-center gap-3 text-left">
                {r.icon ? <img src={r.icon} alt="" className="size-11 rounded-full object-cover" /> : <span className="grid size-11 place-items-center rounded-full bg-white text-[10px] font-semibold text-black">{r.symbol.slice(0, 2)}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.symbol}</span>
                  <span className="block truncate text-xs text-white/45">{r.kind === "pre" ? "PreStock" : r.kind === "x" ? "xStock" : "Spot"} · {r.name}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-sm">{r.price == null ? "—" : r.price >= 1 ? `$${r.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `$${r.price.toPrecision(3)}`}</span>
                  <span className={cn("text-xs", n != null && n < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}</span>
                </span>
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled={busy !== ""} onClick={() => void trade(r, "buy")} className="min-h-11 rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
                  {busy === `${r.id}:buy` ? "…" : `Buy $${usd}`}
                </button>
                <button type="button" disabled={busy !== ""} onClick={() => void trade(r, "sell")} className="min-h-11 rounded-full bg-[#e23b4a] text-sm font-semibold text-white">
                  {busy === `${r.id}:sell` ? "…" : `Sell $${usd}`}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {book.length > cap ? (
        <button type="button" onClick={() => setCap((n) => n + 40)} className="min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
          Show more · {book.length - cap} still on the book
        </button>
      ) : null}
    </div>
  );
}
