import { useEffect, useState } from "react";
import { toast } from "sonner";
import { coinPx } from "@/components/coin-ticker";
import { coinPage } from "@/lib/coin-pages";
import { executeTicket } from "@/lib/ticket-trade";
import { connectPhantom, liveSolAddress } from "@/lib/phantom";
import { getStockFlow, type FlowName } from "@/lib/stock-flow";
import { rememberTrade } from "@/lib/trade-log";
import { type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";
import type { LiveCoin } from "@/lib/coin-tape";

const SIZES = [1, 5, 25] as const;

export function CoinRadar({ house = [], onOpen }: { house?: HouseListing[]; onOpen?: (mint: string) => void }) {
  const wallet = useWallet();
  const [rows, setRows] = useState<LiveCoin[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const [stocks, setStocks] = useState<FlowName[]>([]);
  const [q, setQ] = useState("");
  const [usd, setUsd] = useState<(typeof SIZES)[number]>(5);
  const [busy, setBusy] = useState("");
  const [namePage, setNamePage] = useState(0);
  const sol = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  useEffect(() => {
    void getStockFlow().then(setStocks).catch(() => undefined);
  }, []);

  useEffect(() => {
    let live = true;
    coinPage({ data: { page, q } })
      .then((book) => {
        if (!live) return;
        setRows(book.rows);
        setTotal(book.total);
        setPages(book.pages);
        if (book.page !== page) setPage(book.page);
      })
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [page, q]);

  async function owner() {
    const who = liveSolAddress() || sol || (await connectPhantom());
    if (who !== sol) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return who;
  }

  async function trade(coin: LiveCoin, side: "buy" | "sell") {
    setBusy(`${coin.id}:${side}`);
    try {
      const who = await owner();
      const done = await executeTicket({
        owner: who,
        mint: coin.id,
        side,
        usd,
        decimals: coin.decimals,
        price: coin.price,
      });
      rememberTrade({ symbol: coin.symbol, side, usd, mint: coin.id, signature: done.signature });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${coin.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  const query = q.trim().toLowerCase();
  const names: Array<{ mint: string; symbol: string; name: string; book: string; price: number }> = [];
  if (query) {
    for (const s of stocks) {
      if (`${s.symbol} ${s.name}`.toLowerCase().includes(query)) names.push({ mint: s.mint, symbol: s.symbol, name: s.name, book: "xStock", price: s.price });
    }
    for (const n of house) {
      if (n.venue === "prestocks" && `${n.symbol} ${n.name}`.toLowerCase().includes(query)) {
        names.push({ mint: n.mint, symbol: n.symbol, name: n.name, book: "PreStock", price: n.last });
      }
    }
  }
  const namePages = Math.max(1, Math.ceil(names.length / 24));
  const nameSlice = names.slice(namePage * 24, namePage * 24 + 24);

  return (
    <div className="px-3 pt-4 lg:px-5">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Spot</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight">Every coin, in its own card.</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        {q.trim().length >= 2
          ? `${total.toLocaleString("en-US")} matches. Jupiter search is first, deepest pool first. The same ticker can be more than one mint.`
          : total
            ? `${total.toLocaleString("en-US")} verified coins. Page ${page + 1} of ${pages}. Search finds the rest.`
            : "Waiting on Jupiter."}
      </p>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(0);
          setNamePage(0);
        }}
        placeholder="SOL, NVDA, Anduril"
        className="mt-3 min-h-12 w-full max-w-md rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none"
      />
      {nameSlice.length > 0 ? (
        <ul className="mt-2 max-w-md divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
          {nameSlice.map((h) => (
            <li key={`${h.book}:${h.mint}`}>
              <button type="button" onClick={() => onOpen?.(h.mint)} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left">
                <span>
                  <span className="text-sm font-semibold">{h.symbol}</span>
                  <span className="ml-2 text-[11px] text-subtle">{h.book}</span>
                </span>
                <span className="font-mono text-xs">{h.price > 0 ? coinPx(h.price) : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {names.length > 24 ? (
        <div className="mt-2 flex max-w-md items-center justify-between text-xs text-muted">
          <button type="button" disabled={namePage <= 0} onClick={() => setNamePage((n) => Math.max(0, n - 1))} className="min-h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Back</button>
          <span>{namePage + 1} / {namePages}</span>
          <button type="button" disabled={namePage + 1 >= namePages} onClick={() => setNamePage((n) => n + 1)} className="min-h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Next</button>
        </div>
      ) : null}
      <div className="mt-3 flex gap-1">
        {SIZES.map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 rounded-full px-4 text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15 text-muted")}>
            ${n}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#10131c] px-2 py-2">
            <button type="button" onClick={() => onOpen?.(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {c.icon ? <img src={c.icon} alt="" className="size-8 shrink-0 rounded-full bg-white/10" /> : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-black">{c.symbol.slice(0, 2)}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c.symbol}</span>
                <span className="block truncate font-mono text-[10px] text-subtle">{c.id.slice(0, 4)}…{c.id.slice(-4)}{c.liq ? ` · pool $${Math.round(c.liq).toLocaleString("en-US")}` : ""}</span>
                <span className={cn("font-mono text-[11px] tabular-nums", c.change < 0 ? "text-down" : "text-up")}>
                  {c.change >= 0 ? "+" : ""}
                  {c.change.toFixed(1)}%
                </span>
              </span>
              <span className="font-mono text-sm tabular-nums">{coinPx(c.price)}</span>
            </button>
            <button type="button" disabled={busy !== ""} onClick={() => void trade(c, "buy")} className="min-h-9 shrink-0 rounded-full bg-accent px-3 text-[11px] font-semibold text-accent-fg disabled:opacity-40">
              {busy === `${c.id}:buy` ? "…" : `Buy $${usd}`}
            </button>
            <button type="button" disabled={busy !== ""} onClick={() => void trade(c, "sell")} className="min-h-9 shrink-0 rounded-full border border-white/15 px-3 text-[11px] font-semibold disabled:opacity-40">
              {busy === `${c.id}:sell` ? "…" : `Sell $${usd}`}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button type="button" disabled={page <= 0} onClick={() => setPage((n) => Math.max(0, n - 1))} className="min-h-11 rounded-full bg-white/10 px-4 disabled:opacity-40">Back</button>
        <span className="font-mono text-xs text-muted">{total ? `${page + 1} / ${pages}` : "…"}</span>
        <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((n) => n + 1)} className="min-h-11 rounded-full bg-white px-4 font-semibold text-black disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
