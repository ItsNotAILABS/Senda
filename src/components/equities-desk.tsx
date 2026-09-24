import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
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
  const stock = book.stocks.find((s) => s.symbol === symbol) ?? book.stocks[0];
  const reserve = book.reserves.find((r) => r.symbol === stock?.symbol);
  const [usd, setUsd] = useState(100);
  const [pct, setPct] = useState(0.5);
  const wallet = useWallet();
  const borrow = stock && reserve ? usd * reserve.maxLtv * pct : 0;
  const digest = digestBooks(wallet.w, wallet.usdPer);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return book.stocks;
    return book.stocks.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [book.stocks, query]);

  return (
    <div className="flex flex-col">
      <section className="grid gap-8 border-b border-border px-5 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="border-b border-border xl:border-r xl:border-b-0">
          <div className="flex items-center justify-between gap-3 px-5 py-3 lg:px-8">
            <h2 className="text-sm font-medium">Market</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a share"
              className="min-h-9 w-44 rounded-lg bg-elevated px-3 text-sm outline-none placeholder:text-subtle"
            />
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-subtle">
              <tr>
                <th className="px-5 py-2 font-medium lg:px-8">Share</th>
                <th className="px-2 py-2 font-medium">Session</th>
                <th className="px-2 py-2 text-right font-medium">Max borrow</th>
                <th className="px-5 py-2 text-right font-medium lg:px-8">Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const r = book.reserves.find((x) => x.symbol === s.symbol);
                const on = s.symbol === stock?.symbol;
                return (
                  <tr
                    key={s.mint}
                    onClick={() => setSymbol(s.symbol)}
                    className={cn("cursor-pointer border-t border-border", on ? "bg-elevated" : "hover:bg-surface")}
                  >
                    <td className="px-5 py-3 lg:px-8">
                      <span className="font-medium">{s.symbol}</span>
                      <span className="mt-0.5 block text-xs text-muted">{s.name}</span>
                    </td>
                    <td className="px-2 py-3">
                      <span className={cn("text-xs", s.halted ? "text-down" : s.open ? "text-up" : "text-muted")}>
                        {s.halted ? "Halted" : s.open ? "Open" : "Closed"}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-subtle">{s.hours}</span>
                    </td>
                    <td className="px-2 py-3 text-right font-mono tabular-nums">{r ? `${(r.maxLtv * 100).toFixed(0)}%` : "—"}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums lg:px-8">{r ? `${(r.borrowApy * 100).toFixed(2)}%` : "—"}</td>
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
              <h2 className="font-display text-4xl">{stock.symbol}</h2>
              <p className="mt-2 text-sm text-muted">
                {stock.open && !stock.halted ? "Session is open." : stock.halted ? "Halted." : "Session is closed. Loan terms are still live."}
              </p>
              <div className="mt-4 flex gap-1">
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
