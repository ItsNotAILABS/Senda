import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
import { LiveChart } from "@/components/price-chart";
import { outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { type EquityBook, type ListedStock, type StockReserve } from "@/lib/equities";
import { WalletPicker } from "@/components/wallet-picker";
import { digestBooks } from "@/lib/books";
import { CCYS, formatMoney } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function EquitiesDesk({ book }: { book: EquityBook }) {
  const [symbol, setSymbol] = useState(book.stocks.find((s) => s.symbol === "SPYx")?.symbol ?? book.stocks[0]?.symbol ?? "");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "etf" | "stock">("all");
  const stock = book.stocks.find((s) => s.symbol === symbol) ?? book.stocks[0];
  const reserve = book.reserves.find((r) => r.symbol === stock?.symbol);
  const [usd, setUsd] = useState(100);
  const [pct, setPct] = useState(0.5);
  const wallet = useWallet();
  const borrow = stock && reserve ? usd * reserve.maxLtv * pct : 0;
  const digest = digestBooks(wallet.w, wallet.usdPer);
  const isEtf = (s: ListedStock) => /etf/i.test(`${s.name} ${s.symbol} ${s.underlying}`);
  const etfCount = book.stocks.filter(isEtf).length;
  const rows = useMemo(() => {
    const pool = kind === "etf" ? book.stocks.filter((s) => /etf/i.test(`${s.name} ${s.symbol} ${s.underlying}`)) : kind === "stock" ? book.stocks.filter((s) => !/etf/i.test(`${s.name} ${s.symbol} ${s.underlying}`)) : book.stocks;
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((s) => [s.symbol, s.name, s.underlying, s.exchange].join(" ").toLowerCase().includes(q));
  }, [book.stocks, query, kind]);

  return (
    <div className="flex flex-col">
      <section className="order-2 grid gap-8 border-b border-border px-5 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div>
          <p className="text-sm text-muted">
            {reserve ? `You can spend this without selling ${stock?.symbol}` : "Pick a share Kamino will lend against"}
          </p>
          <p className="mt-2 font-display text-7xl tabular-nums tracking-tight">
            {reserve ? `$${borrow.toFixed(0)}` : "—"}
          </p>
          <p className="mt-3 max-w-xl text-sm text-muted">
            {reserve
              ? `That is ${(pct * 100).toFixed(0)}% of what Kamino allows on $${usd} of ${stock?.symbol}. The share stays yours. The store never sees it.`
              : `${stock?.symbol ?? "This name"} is listed, but it is not in the Kamino xStocks market. SPYx is.`}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {CCYS.map((c) => (
              <span key={c} className="rounded-full bg-elevated px-3 py-1 font-mono text-xs tabular-nums">
                {c} {formatMoney(wallet.w.balances[c] || 0, c)}
              </span>
            ))}
            <span className={cn("rounded-full px-3 py-1 font-mono text-xs", digest.tied ? "bg-elevated text-up" : "bg-down/15 text-down")}>
              Books {digest.tied ? "tied" : "break"}
            </span>
          </div>
        </div>
        {stock && reserve ? (
          <GhostSpend
            amount={borrow}
            stock={stock.symbol}
            onMint={(cap, merchant) => wallet.issueCheckout(cap, merchant, "SENDA")}
          />
        ) : null}
      </section>

      <div className="order-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="border-b border-border xl:border-r xl:border-b-0">
          <div className="flex gap-2 overflow-x-auto px-4 pt-4">
            {(
              [
                ["all", `All ${book.stocks.length}`],
                ["etf", `ETFs ${etfCount}`],
                ["stock", `Stocks ${book.stocks.length - etfCount}`],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setKind(id)} className={cn("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold", kind === id ? "bg-white text-black" : "bg-[#2a2a2e] text-white/80")}>
                {label}
              </button>
            ))}
          </div>
          <div className="px-4 py-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a name"
              className="min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none placeholder:text-white/35"
            />
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-white/40">
              <tr>
                <th className="px-4 py-2 font-medium">Share</th>
                <th className="px-2 py-2 font-medium">Session</th>
                <th className="px-2 py-2 text-right font-medium">24h</th>
                <th className="px-4 py-2 text-right font-medium">Borrow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const r = book.reserves.find((x) => x.symbol === s.symbol);
                const on = s.symbol === stock?.symbol;
                const vol = r?.supplyUsd ? (r.supplyUsd >= 1e6 ? `$${(r.supplyUsd / 1e6).toFixed(1)}M` : r.supplyUsd >= 1e3 ? `$${Math.round(r.supplyUsd / 1e3)}k` : `$${Math.round(r.supplyUsd)}`) : "—";
                return (
                  <tr key={s.mint} onClick={() => setSymbol(s.symbol)} className={cn("cursor-pointer border-t border-white/10", on ? "bg-white/5" : "")}>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{s.symbol}</span>
                      <span className="mt-0.5 block text-xs text-white/45">{s.name}</span>
                    </td>
                    <td className="px-2 py-3">
                      <span className={cn("text-xs", s.open ? "text-[#d7e36a]" : "text-white/45")}>{s.halted ? "Halted" : s.open ? "Open" : "Closed"}</span>
                      <span className="mt-0.5 block text-[11px] text-white/40">{s.hours}</span>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs tabular-nums">{vol}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{r ? `${(r.maxLtv * 100).toFixed(0)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No share by that name.</p> : null}
        </section>

        <aside className="px-5 py-4 lg:px-6">
          {stock ? (
            <>
              <p className="text-xs text-subtle">{stock.name}</p>
              <h2 className="text-2xl font-semibold">{stock.symbol}</h2>
              <p className="mt-2 text-sm text-muted">
                {stock.underlying ? `${stock.underlying} on ${stock.exchange || "the listing exchange"}.` : "Listed share."}{" "}
                {stock.open && !stock.halted ? `Session is ${stock.period || "open"}.` : stock.halted ? "Halted." : "Session is closed."}
                {stock.isin ? ` ISIN ${stock.isin}.` : ""}
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-subtle">{stock.mint}</p>
              <div className="mt-3">
                <LiveChart mint={stock.mint} symbol={stock.symbol} />
              </div>
              {stock.minOrder ? (
                <p className="mt-2 text-xs text-muted">
                  Issuer min ${stock.minOrder.toLocaleString("en-US")}
                  {stock.maxOrder ? ` · max $${stock.maxOrder.toLocaleString("en-US")}` : ""} this session. Jupiter on this desk is not that gate.
                </p>
              ) : null}
              <div className="mt-4 flex gap-1">
                <input
                  inputMode="decimal"
                  defaultValue={usd}
                  key={usd}
                  aria-label="Size in USDC"
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n > 0) setUsd(n);
                  }}
                  className="min-h-9 w-16 rounded-lg bg-elevated px-2 font-mono text-xs outline-none"
                />
                {[100, 500, 2000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setUsd(n)}
                    className={cn("min-h-9 rounded-lg px-3 font-mono text-xs tabular-nums", usd === n ? "bg-fg text-bg" : "bg-elevated text-muted")}
                  >
                    ${n}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-border p-4">
                <p className="text-xs text-subtle">Buy</p>
                <Quote mint={stock.mint} usd={usd} />
                <FillButton
                  mint={stock.mint}
                  usd={usd}
                  label={`Buy $${usd} in your wallet`}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent"
                />
              </div>
              {reserve ? (
                <div className="mt-3 rounded-xl border border-border p-4">
                  <Collateral stock={stock} reserve={reserve} usd={usd} pct={pct} onPct={setPct} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">Kamino does not lend against this one.</p>
              )}
              <div className="mt-6 border-t border-border pt-4">
                <WalletPicker />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">No listed names.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Quote({ mint, usd }: { mint: string; usd: number }) {
  const [q, setQ] = useState<JupQuote | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    setQ(null);
    quoteJup({ data: { mint, usd, side: "buy" } })
      .then((r) => live && setQ(r))
      .catch(() => live && setQ({ error: "No Jupiter route" }));
    return () => {
      live = false;
    };
  }, [mint, usd]);
  if (!q) return <p className="mt-2 text-sm text-muted">Asking Jupiter…</p>;
  if ("error" in q) return <p className="mt-2 text-sm text-down">{q.error}</p>;
  return (
    <p className="mt-2 font-mono text-sm">
      ${usd} buys {outUi(q, 8).toFixed(4)} · {q.route[0] || "Jupiter"}
    </p>
  );
}

function Collateral({
  stock,
  reserve,
  usd,
  pct,
  onPct,
}: {
  stock: ListedStock;
  reserve: StockReserve;
  usd: number;
  pct: number;
  onPct: (n: number) => void;
}) {
  const [q, setQ] = useState<JupQuote | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    quoteJup({ data: { mint: stock.mint, usd, side: "buy" } })
      .then((r) => live && setQ(r))
      .catch(() => live && setQ({ error: "no quote" }));
    return () => {
      live = false;
    };
  }, [stock.mint, usd]);
  const tokens = q && !("error" in q) ? outUi(q, 8) : 0;
  const maxBorrow = usd * reserve.maxLtv * pct;
  return (
    <>
      <p className="text-xs text-subtle">Borrow</p>
      <p className="mt-1 text-sm">
        ${usd.toFixed(0)} of {stock.symbol}
        {tokens ? ` is about ${tokens.toFixed(4)} tokens` : ""}. Kamino lends up to {(reserve.maxLtv * 100).toFixed(0)}%.
      </p>
      <label className="mt-3 block text-xs text-subtle">How much of that limit</label>
      <input
        type="range"
        min={0.1}
        max={1}
        step={0.05}
        value={pct}
        onChange={(e) => onPct(Number(e.target.value))}
        className="mt-1 w-full"
      />
      <p className="font-mono text-sm">${maxBorrow.toFixed(0)} USDC · {(reserve.borrowApy * 100).toFixed(2)}% a year</p>
      <p className="mt-1 text-xs text-subtle">
        ${fmt(reserve.supplyUsd)} already in this market. If the share falls through the limit, Kamino can sell part of it.
      </p>
      <p className="mt-3 text-sm text-muted">The buy signs in your wallet. This page does not send you out to borrow.</p>
    </>
  );
}

function GhostSpend({
  amount,
  stock,
  onMint,
}: {
  amount: number;
  stock: string;
  onMint: (
    cap: number,
    merchant: string,
  ) => { ok: true; reveal: { pan: string; cvv: string; expiry: string; last4: string } } | { ok: false; error: string };
}) {
  const [reveal, setReveal] = useState<{ pan: string; cvv: string; expiry: string; last4: string } | null>(null);
  const cap = Math.max(1, Math.round(amount));
  return (
    <div className="rounded-xl bg-fg p-4 text-bg">
      <p className="text-xs uppercase opacity-60">Pay</p>
      <p className="mt-1 text-sm">
        One number for ${cap}, locked to {stock}. The store sees this. It does not see the share or your bank. We do not keep the number.
      </p>
      {!reveal ? (
        <button
          type="button"
          onClick={() => {
            const r = onMint(cap, stock);
            if (!r.ok) toast.error(r.error);
            else setReveal(r.reveal);
          }}
          className="mt-3 min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          Mint the number
        </button>
      ) : (
        <>
          <p className="mt-3 font-mono text-lg tracking-wide">{reveal.pan}</p>
          <p className="mt-1 font-mono text-sm opacity-70">
            {reveal.expiry} · {reveal.cvv}
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(reveal.pan.replace(/\s/g, ""));
              toast.success("Copied. Still not saved.");
            }}
            className="mt-3 min-h-10 rounded-lg bg-bg px-4 text-sm font-semibold text-fg"
          >
            Copy
          </button>
        </>
      )}
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toFixed(0);
}
