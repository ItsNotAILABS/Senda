import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AddMoneyScreen } from "@/components/add-money";
import { TokenMark } from "@/components/token-mark";
import { applyHouseDrop, loadHouseBook, saveHouseBook } from "@/lib/house-paper";
import { rails } from "@/lib/ecosystem";
import { formatClock, minuteId, remainingMs } from "@/lib/minute-book";
import { formatUsdTiny, protectCost, quotePeg, type PegQuote } from "@/lib/peg";
import { loadPegs, openPeg, settlePegs } from "@/lib/peg-book";
import { formatChg, formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

const CHIPS = [10, 25, 100];

function Spark({ last, mark, chg }: { last: number; mark: number; chg: number }) {
  const d = useMemo(() => {
    const n = 28;
    const pts: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const t = i / (n - 1);
      const from = last / (1 + chg * (1 - t) * 0.85);
      pts.push(from);
    }
    pts[n - 1] = last;
    const lo = Math.min(...pts, mark) * 0.995;
    const hi = Math.max(...pts, mark) * 1.005;
    const span = hi - lo || 1;
    const line = pts
      .map((y, i) => `${(i / (n - 1)) * 100},${((hi - y) / span) * 36 + 2}`)
      .join(" ");
    const my = ((hi - mark) / span) * 36 + 2;
    return { line, my };
  }, [last, mark, chg]);

  return (
    <svg viewBox="0 0 100 40" className="h-16 w-full" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.4" points={d.line} className="text-down" />
      <line x1="0" x2="100" y1={d.my} y2={d.my} className="text-muted" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 2" />
    </svg>
  );
}

export function MarketStream({
  house,
  cash,
  onDebit,
  onCredit,
}: {
  house: HouseListing[];
  cash: number;
  onDebit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  onCredit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const names = house.filter((h) => h.venue === "prestocks" && h.last > 0 && h.mark > 0 && !/xai/i.test(h.symbol));
  const featured =
    [...names].sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0))[0] ?? names[0] ?? null;
  const [focusId, setFocusId] = useState<string | null>(null);
  const focus = names.find((n) => n.id === (focusId ?? featured?.id)) ?? featured;
  const [dollars, setDollars] = useState(25);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [how, setHow] = useState(false);
  const [openHowId, setOpenHowId] = useState<string | null>(null);

  const lastSettle = useRef(0);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const m = minuteId(now);
    if (m === lastSettle.current) return;
    const prices = Object.fromEntries(names.map((n) => [n.id, { last: n.last, mark: n.mark }]));
    const done = settlePegs(prices);
    lastSettle.current = m;
    for (const t of done) {
      if (t.pnl > 0) {
        void onCredit(t.pnl, `peg ${t.symbol}`);
        toast.success(`${t.symbol} peg paid ${formatUsdTiny(t.pnl)}`);
      }
    }
  }, [now, names, onCredit]);

  const clock = now ? formatClock(remainingMs(now)) : "—:—";
  const q = focus ? quotePeg(focus) : null;
  const extra = focus && q ? protectCost(q, dollars, focus.last) : 0;
  const live = loadPegs().filter((p) => !p.settled);

  async function buyProtect(stock: HouseListing, spend: number) {
    const quote = quotePeg(stock);
    if (!quote) {
      toast.error("No mark on this name.");
      return;
    }
    const rider = protectCost(quote, spend, stock.last);
    const total = spend + rider;
    if (cash < total) {
      toast.error("Not enough cash.");
      setAddOpen(true);
      return;
    }
    setBusy(stock.id);
    try {
      const d = await onDebit(total, `${stock.symbol} buy+protect`);
      if (!d.ok) {
        toast.error(d.error);
        return;
      }
      const shares = spend / stock.last;
      saveHouseBook(applyHouseDrop(loadHouseBook(), stock.id, "yes", spend, stock.last));
      openPeg({
        stockId: stock.id,
        symbol: stock.symbol,
        shares,
        spend,
        premiumPaid: rider,
        elPerShare: quote.expectedLoss,
        entryLast: stock.last,
        entryMark: stock.mark,
      });
      toast.success(`${stock.symbol} · bought $${spend} + ${formatUsdTiny(rider)} peg`);
    } finally {
      setBusy(null);
    }
  }

  if (!focus || !q) {
    return <p className="px-4 py-10 text-sm text-muted">Waiting on PreStocks last vs mark.</p>;
  }

  return (
    <div className="pb-8">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}

      <header className="relative overflow-hidden px-4 pt-4">
        <img src="/images/term-sheet.jpg" alt="" className="absolute inset-0 h-36 w-full object-cover opacity-25" />
        <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted">Market stream</p>
          <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-fg">
            {clock}
          </span>
        </div>
        <button type="button" onClick={() => setFocusId(focus.id)} className="mt-3 flex w-full items-start gap-3 text-left">
          <TokenMark stock={focus} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-5xl leading-none tracking-tight">{focus.symbol}</p>
            <p className="mt-1 truncate text-sm text-muted">{focus.name}</p>
          </div>
        </button>
        <p className="mt-3 font-display text-5xl leading-none tabular-nums">{formatUsd(focus.last)}</p>
        <p className={cn("mt-2 text-sm font-semibold", (focus.change24h ?? 0) < 0 ? "text-down" : "text-up")}>
          {formatChg(focus.change24h)} · {formatPremium(focus.premium)} vs mark
        </p>
        <Spark last={focus.last} mark={focus.mark} chg={focus.change24h ?? 0} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <QuoteBox label="Token price" value={formatUsd(focus.last)} hint="SPL print · Jupiter" />
          <QuoteBox label="SPV mark" value={formatUsd(focus.mark)} hint="1:1 SPV backing" />
        </div>
        </div>
      </header>

      <section className="mx-3 mt-4 rounded-2xl bg-paper p-4 text-ink">
        <p className="text-[11px] font-semibold tracking-wide uppercase text-ink/50">Per-minute peg</p>
        <p className="mt-1 font-display text-2xl leading-snug">Peg the SPL against the SPV mark</p>
        <p className="mt-2 text-sm text-ink/70">
          {formatUsdTiny(q.expectedLoss)} expected loss + {formatUsdTiny(q.spread)} spread ={" "}
          <span className="font-semibold">{formatUsdTiny(q.premiumMin)}/min</span> per share
        </p>
        <p className="mt-1 font-mono text-xs text-ink/45">
          Accrued this window {formatUsdTiny(q.premiumMin * (1 - remainingMs(now) / 60_000))}
        </p>
        <button type="button" onClick={() => setHow((v) => !v)} className="mt-2 text-sm font-medium underline">
          How we make money
        </button>
        {how ? <p className="mt-2 text-xs leading-relaxed text-ink/65">{q.how}</p> : null}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-ink/5 px-3 py-3">
          <p className="text-sm">
            Next window
            <span className="block text-xs text-ink/50">last checked vs mark · 60s</span>
          </p>
          <p className="font-display text-3xl tabular-nums">{clock}</p>
        </div>
        <p className="mt-2 text-xs text-ink/50">Floor {formatUsd(q.floor)} · {q.thin.toFixed(1)}× thin book</p>
        <div className="mt-3 flex gap-1">
          {CHIPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDollars(n)}
              className={cn(
                "min-h-11 flex-1 rounded-full text-sm font-semibold",
                dollars === n ? "bg-ink text-paper" : "bg-ink/10 text-ink",
              )}
            >
              ${n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/55">
          ${dollars} name + {formatUsdTiny(extra)} peg = {formatUsdTiny(dollars + extra)}
        </p>
        {cash < 1 ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-3 min-h-12 w-full rounded-full bg-ink text-sm font-semibold text-paper"
          >
            Add money to trade
          </button>
        ) : (
          <button
            type="button"
            disabled={busy === focus.id}
            onClick={() => void buyProtect(focus, dollars)}
            className="mt-3 min-h-12 w-full rounded-full bg-ink text-sm font-semibold text-paper disabled:opacity-50"
          >
            Buy + Protect
          </button>
        )}
        <a
          href={rails(focus.mint, focus.symbol).jupiter}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-center text-xs font-semibold text-ink/55"
        >
          Live size · Jupiter USDC → {focus.symbol}
        </a>
      </section>

      {live.length > 0 ? (
        <p className="px-4 pt-3 text-xs text-muted">
          {live.length} peg{live.length === 1 ? "" : "s"} open this minute
        </p>
      ) : null}

      <p className="px-4 pt-6 pb-2 text-xs font-medium tracking-wide text-subtle uppercase">
        PreStocks lineup
      </p>
      <div className="grid grid-cols-1 gap-2 px-3 sm:grid-cols-2 xl:grid-cols-3">
        {names.map((s) => (
          <PegCard
            key={s.id}
            stock={s}
            dollars={dollars}
            openHow={openHowId === s.id}
            onHow={() => setOpenHowId(openHowId === s.id ? null : s.id)}
            onFocus={() => setFocusId(s.id)}
            busy={busy === s.id}
            onBuy={() => void buyProtect(s, dollars)}
            needMoney={cash < 1}
            onAdd={() => setAddOpen(true)}
          />
        ))}
      </div>
    </div>
  );
}

function QuoteBox({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border px-3 py-3">
      <p className="text-[11px] text-subtle">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function PegCard({
  stock,
  dollars,
  openHow,
  onHow,
  onFocus,
  busy,
  onBuy,
  needMoney,
  onAdd,
}: {
  stock: HouseListing;
  dollars: number;
  openHow: boolean;
  onHow: () => void;
  onFocus: () => void;
  busy: boolean;
  onBuy: () => void;
  needMoney: boolean;
  onAdd: () => void;
}) {
  const q = quotePeg(stock);
  if (!q) return null;
  const rider = protectCost(q, dollars, stock.last);
  return (
    <article className="flex flex-col rounded-2xl bg-paper p-3 text-ink">
      <button type="button" onClick={onFocus} className="text-left">
        <div className="flex items-start gap-2">
          <TokenMark stock={stock} size={36} />
          <div className="min-w-0">
            <p className="font-display text-lg leading-none">{stock.symbol}</p>
            <p className="mt-0.5 truncate text-[11px] text-ink/45">{stock.name}</p>
          </div>
        </div>
        <p className="mt-2 font-display text-2xl leading-none tabular-nums">{formatUsd(stock.last)}</p>
        <p className={cn("mt-1 text-[11px] font-medium", (stock.premium ?? 0) > 0 ? "text-down" : "text-up")}>
          {q.thin.toFixed(1)}× thin · {formatPremium(stock.premium)} mark
        </p>
        <p className="mt-1 text-[11px] leading-snug text-ink/60">
          {formatUsdTiny(q.expectedLoss)} EL + {formatUsdTiny(q.spread)} = {formatUsdTiny(q.premiumMin)}/min
        </p>
      </button>
      <button type="button" onClick={onHow} className="mt-1 text-left text-[11px] font-medium underline">
        How we make money
      </button>
      {openHow ? <p className="mt-1 text-[11px] leading-snug text-ink/60">{q.how}</p> : null}
      <p className="mt-2 font-mono text-[11px] text-ink/45">+{formatUsdTiny(rider)} peg on ${dollars}</p>
      <button
        type="button"
        disabled={busy}
        onClick={needMoney ? onAdd : onBuy}
        className="mt-2 min-h-11 rounded-full bg-ink text-xs font-semibold text-paper disabled:opacity-50"
      >
        {needMoney ? "Add money" : "Buy + Protect"}
      </button>
    </article>
  );
}
