import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { jupTape, type TapeRow } from "@/lib/world-book";
import { previewFill } from "@/lib/fill-quote";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { useHouse } from "@/lib/use-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const SIZES = [1, 5, 25];

type Kind = "coin" | "x" | "pre";
type Card = {
  id: string;
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  icon?: string;
  kind: Kind;
};

function pct(change: number | null) {
  if (change == null) return null;
  return Math.abs(change) <= 2 ? change * 100 : change;
}

function money(n: number | null) {
  if (n == null || !(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(3)}`;
}

export function SpotPage({
  scope = "coins",
  bare = false,
}: {
  scope?: "coins" | "x" | "pre" | "all";
  bare?: boolean;
}) {
  const house = useHouse();
  const { w, linkChain } = useWallet();
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [q, setQ] = useState("");
  const [size, setSize] = useState(5);
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState("");
  const [lens, setLens] = useState<Kind | "all">(scope === "coins" ? "coin" : scope);
  const [sort, setSort] = useState<"gain" | "loss" | "price" | "name">("gain");
  const [cap, setCap] = useState(24);
  const owner = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  useEffect(() => {
    jupTape()
      .then(setTape)
      .catch(() => undefined);
  }, []);

  const book = useMemo(() => {
    const seen = new Set<string>();
    const cards: Card[] = [];
    for (const h of house) {
      if (!(h.last > 0) || !h.mint || seen.has(h.mint)) continue;
      seen.add(h.mint);
      cards.push({
        id: h.mint,
        symbol: h.symbol,
        name: h.name,
        price: h.last,
        change: h.change24h,
        icon: h.image || undefined,
        kind: h.venue === "prestocks" ? "pre" : "x",
      });
    }
    for (const r of tape) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      cards.push({
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        price: r.price,
        change: r.change,
        icon: r.icon,
        kind: /x$/i.test(r.symbol) ? "x" : "coin",
      });
    }
    const query = q.trim().toLowerCase();
    const want = bare ? "pre" : lens;
    const filtered = cards.filter((c) => {
      if (query && !`${c.symbol} ${c.name}`.toLowerCase().includes(query)) return false;
      if (want === "all") return true;
      return c.kind === want;
    });
    filtered.sort((a, b) => {
      if (sort === "name") return a.symbol.localeCompare(b.symbol);
      if (sort === "price") return (b.price ?? 0) - (a.price ?? 0);
      const av = pct(a.change) ?? -1e9;
      const bv = pct(b.change) ?? -1e9;
      return sort === "loss" ? av - bv : bv - av;
    });
    return filtered;
  }, [house, tape, q, lens, bare, sort]);

  async function trade(mint: string, symbol: string, side: "buy" | "sell") {
    if (size < 1) return toast.error("A trade is at least $1.");
    setBusy(`${mint}:${side}`);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const kept = linkChain(who, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const price = book.find((c) => c.id === mint)?.price ?? undefined;
      const preview = await previewFill({ mint, side, usd: size, price, symbol });
      if (preview.impact > 5) throw new Error(`Price impact is ${preview.impact.toFixed(1)}%. Nothing was sent.`);
      setQuote(preview.line);
      const done = await runPrestock({ owner: who, mint, side, usd: size, price, symbol });
      toast.success(`${preview.line}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  const coins = book.filter((c) => c.kind === "coin").length;
  const shown = book.slice(0, cap);

  return (
    <div className={bare ? "mt-4" : "px-3 py-3 lg:px-4"}>
      {bare ? (
        <p className="mb-2 text-sm font-semibold">Trade the name</p>
      ) : (
        <header>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">{scope === "all" ? "Quotes" : "Spot"}</p>
          <h1 className="mt-1 text-3xl tracking-tight">{scope === "all" ? "The whole book." : "Every coin, in its own card."}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {scope === "all"
              ? `${book.length.toLocaleString("en-US")} products. Square cards are coins only. Names and shares stay on the list.`
              : `${coins || book.length} coins. Each one is a card. Buy and sell sign in the wallet.`}
          </p>
        </header>
      )}
      {bare ? null : (
        <input value={q} onChange={(e) => { setQ(e.target.value); setCap(24); }} placeholder="SOL, NVDA, Anduril" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      )}
      {bare ? null : (
        <div className="mt-3 flex gap-2">
          {(
            [
              ["all", "All"],
              ["coin", "Coins"],
              ["x", "xStocks"],
              ["pre", "PreStocks"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setLens(id); setCap(24); }} className={cn("min-h-9 rounded-full px-3 text-sm font-semibold", lens === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
              {label}
            </button>
          ))}
        </div>
      )}
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
      <div className="mt-3 flex gap-2">
        {SIZES.map((n) => (
          <button key={n} type="button" onClick={() => setSize(n)} className={cn("grid size-11 place-items-center rounded-full text-sm font-semibold", size === n ? "bg-white text-black" : "border border-white/15 text-white")}>
            ${n}
          </button>
        ))}
        <input
          inputMode="decimal"
          value={String(size)}
          onChange={(e) => setSize(Math.max(0, Number(e.target.value) || 0))}
          className="min-h-11 w-24 rounded-full bg-[#1c1c1e] px-4 font-mono text-sm outline-none"
          aria-label="Dollars"
        />
      </div>
      {quote ? <p className="mt-3 text-sm text-[#d7e36a]">{quote}</p> : <p className="mt-3 text-xs text-white/40">The quote API answers before Phantom is asked to sign.</p>}
      {lens === "coin" ? (
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {shown.map((r) => {
          const n = pct(r.change);
          return (
            <li key={r.id} className="flex min-h-[210px] flex-col rounded-[22px] border border-white/10 bg-[#10131c] p-3">
              <div className="flex items-center gap-2">
                {r.icon ? (
                  <img src={r.icon} alt="" className="size-9 rounded-full bg-white object-cover" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-full bg-white text-[10px] font-semibold text-black">{r.symbol.slice(0, 2)}</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.symbol}</span>
                  <span className={cn("block text-xs", n != null && n < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                    {n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
                  </span>
                </span>
              </div>
              <p className="mt-3 font-mono text-2xl tracking-tight">{money(r.price)}</p>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <button type="button" disabled={busy !== ""} onClick={() => void trade(r.id, r.symbol, "buy")} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
                  {busy === `${r.id}:buy` ? "…" : `Buy $${size}`}
                </button>
                <button type="button" disabled={busy !== ""} onClick={() => void trade(r.id, r.symbol, "sell")} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold">
                  {busy === `${r.id}:sell` ? "…" : `Sell $${size}`}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      ) : (
      <ul className="mt-3 divide-y divide-white/10">
        {shown.map((r) => {
          const n = pct(r.change);
          const tag = r.kind === "pre" ? "PreStock" : r.kind === "x" ? "xStock" : "Coin";
          return (
            <li key={r.id} className="flex items-center gap-3 py-3">
              {r.icon ? (
                <img src={r.icon} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[10px] font-semibold text-black">{r.symbol.slice(0, 3)}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.symbol}</span>
                <span className="block truncate text-xs text-white/45">{tag} · {r.name}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm">{money(r.price)}</span>
                <span className={cn("block text-xs", n != null && n < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                  {n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
                </span>
              </span>
              <span className="grid shrink-0 grid-cols-1 gap-1">
                <button type="button" disabled={busy !== ""} onClick={() => void trade(r.id, r.symbol, "buy")} className="min-h-8 rounded-full bg-[#d7e36a] px-3 text-xs font-semibold text-black">
                  {busy === `${r.id}:buy` ? "…" : "Buy"}
                </button>
                <button type="button" disabled={busy !== ""} onClick={() => void trade(r.id, r.symbol, "sell")} className="min-h-8 rounded-full border border-white/15 px-3 text-xs font-semibold">
                  {busy === `${r.id}:sell` ? "…" : "Sell"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      )}
      {book.length > cap ? (
        <button type="button" onClick={() => setCap((n) => n + 24)} className="mt-3 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
          Show more · {(book.length - cap).toLocaleString("en-US")} still on the book
        </button>
      ) : null}
      {book.length === 0 ? <p className="py-6 text-sm text-muted">Waiting on Jupiter.</p> : null}
    </div>
  );
}
