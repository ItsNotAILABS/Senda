import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { OrderTicket } from "@/components/order-ticket";
import { TokenMark } from "@/components/token-mark";
import { TokenRails } from "@/components/token-rails";
import { OptionChain } from "@/components/option-chain";
import { counterpartOf, EXPOSURE, vsMarkLine } from "@/lib/explain";
import { applyHouseDrop, loadHouseBook, markHouse, saveHouseBook } from "@/lib/house-paper";
import type { Side } from "@/lib/lmsr";
import {
  chainFor,
  formatStrike,
  type OptContract,
  type OptTenor,
} from "@/lib/option-chain";
import { placeOption } from "@/lib/option-book";
import { protectCost, quotePeg } from "@/lib/peg";
import { openPeg } from "@/lib/peg-book";
import {
  formatChg,
  formatPremium,
  formatUsd,
  formatValuation,
  type HouseListing,
} from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function HouseTable({
  stock,
  rows,
  chips,
  frozen,
  onTrade,
  onDebit,
  onCredit,
}: {
  stock: HouseListing;
  rows: HouseListing[];
  chips: number;
  frozen: boolean;
  onBuyIn?: () => Promise<{ ok: boolean; error?: string }>;
  onTrade?: (
    side: Side,
    spend: number,
  ) => Promise<{ ok: boolean; error?: string; cost?: number; shares?: number }>;
  onDebit?: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  onCredit?: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [spend, setSpend] = useState(0);
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState(() => loadHouseBook());
  const [ticket, setTicket] = useState<Side | null>(null);
  const [opt, setOpt] = useState<OptContract | null>(null);
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const pos = book[stock.id];
  const mtm = markHouse(pos, stock.last);
  const pnl = mtm - (pos?.cost ?? 0);
  const other = counterpartOf(stock, rows);
  const down = (stock.change24h ?? 0) < 0;
  const rich = (stock.premium ?? 0) > 0;
  const sellLabel = pos && pos.shares > 0 ? "Sell" : "Short";

  function enough(n: number): boolean {
    if (frozen) {
      toast.error("Book is frozen.");
      return false;
    }
    if (chips >= n) return true;
    toast.error("Not enough cash. Add money first.");
    return false;
  }

  async function fill(side: Side) {
    if (busy) return;
    setBusy(true);
    try {
      if (!enough(spend)) return;
      if (onTrade) {
        const res = await onTrade(side, spend);
        if (!res.ok) {
          toast.error(res.error ?? "Fill rejected.");
          return;
        }
      }
      const next = applyHouseDrop(loadHouseBook(), stock.id, side, spend, stock.last);
      saveHouseBook(next);
      setBook(next);
      setTicket(null);
      toast.success(
        `${side === "yes" ? "Bought" : "Sold"} ${stock.symbol} · $${spend} @ ${formatUsd(stock.last)}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not fill.");
    } finally {
      setBusy(false);
    }
  }

  async function liftOpt(c: OptContract) {
    if (busy || !onDebit) return;
    setBusy(true);
    try {
      if (!enough(spend)) return;
      const deb = await onDebit(spend, c.id);
      if (!deb.ok) {
        toast.error(deb.error ?? "Could not lift.");
        return;
      }
      const row = placeOption({
        underlyingId: c.underlyingId,
        symbol: c.symbol,
        kind: c.kind,
        strike: c.strike,
        tenor: c.tenor,
        expiryAt: c.expiryAt,
        spend,
        ask: c.ask,
      });
      if ("error" in row) {
        toast.error(row.error);
        await onCredit?.(spend, "opt:rollback");
        return;
      }
      setOpt(null);
      toast.success(
        `${c.kind === "call" ? "Call" : "Put"} ${c.symbol} ${formatStrike(c.strike)} · $${spend}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const atm = chainFor(stock, tenor).find((c) => c.atm && c.kind === "call");

  return (
    <main className="flex w-full flex-1 flex-col">
      <div className="px-4 pt-4 pb-36">
        <Link to="/invest" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted">
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          PreStocks
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <TokenMark stock={stock} size={56} />
          <div>
            <p className="text-sm text-muted">{stock.name}</p>
            <h1 className="font-display text-4xl tracking-tight">{stock.symbol}</h1>
          </div>
        </div>
        <p className="mt-3 font-display text-6xl leading-none tracking-tight tabular-nums">{formatUsd(stock.last)}</p>
        <p className={cn("mt-2 text-base font-semibold tabular-nums", down ? "text-down" : "text-up")}>
          {formatChg(stock.change24h)} today
        </p>
        <p className={cn("text-sm font-semibold tabular-nums", rich ? "text-down" : "text-up")}>
          {formatPremium(stock.premium)} to mark {formatUsd(stock.mark)}
        </p>

        <section className="mt-6 rounded-2xl bg-paper p-4 text-ink">
          <p className="text-[11px] font-semibold tracking-wide uppercase text-ink/50">Token vs SPV mark</p>
          <p className="mt-1 font-display text-2xl leading-snug">Peg {stock.symbol} last to the SPV</p>
          <p className="mt-2 text-sm text-ink/60">
            Buy the print, not the company. {EXPOSURE} Live size is a Jupiter USDC swap.
          </p>
          <p className="mt-2 font-mono text-xs text-ink/45">{vsMarkLine(stock)}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const peg = quotePeg(stock);
              const amt = spend > 0 ? spend : 25;
              if (!peg) {
                toast.error("No mark.");
                return;
              }
              if (!enough(amt + protectCost(peg, amt, stock.last))) return;
              setSpend(amt);
              void (async () => {
                setBusy(true);
                try {
                  const rider = protectCost(peg, amt, stock.last);
                  const total = amt + rider;
                  if (onDebit) {
                    const d = await onDebit(total, `${stock.symbol} buy+protect`);
                    if (!d.ok) {
                      toast.error(d.error);
                      return;
                    }
                  } else if (onTrade) {
                    const res = await onTrade("yes", total);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                  }
                  const next = applyHouseDrop(loadHouseBook(), stock.id, "yes", amt, stock.last);
                  saveHouseBook(next);
                  setBook(next);
                  openPeg({
                    stockId: stock.id,
                    symbol: stock.symbol,
                    shares: amt / stock.last,
                    spend: amt,
                    premiumPaid: rider,
                    elPerShare: peg.expectedLoss,
                    entryLast: stock.last,
                    entryMark: stock.mark,
                  });
                  toast.success(`Bought ${stock.symbol} + peg ${rider.toFixed(2)}`);
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="mt-4 min-h-12 w-full rounded-full bg-ink text-sm font-semibold text-paper"
          >
            Buy + Protect
          </button>
        </section>

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-subtle">Mark</dt>
            <dd className="font-semibold tabular-nums">{formatUsd(stock.mark)}</dd>
          </div>
          <div>
            <dt className="text-subtle">Implied</dt>
            <dd className="font-semibold tabular-nums">{formatValuation(stock.valuation)}</dd>
          </div>
          <div>
            <dt className="text-subtle">24h</dt>
            <dd className={cn("font-semibold tabular-nums", down ? "text-down" : "text-up")}>
              {formatChg(stock.change24h)}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">Instrument</dt>
            <dd className="font-semibold">SPL · 1:1 SPV</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-muted">{vsMarkLine(stock)}</p>
        <p className="mt-2 break-all font-mono text-xs text-subtle">{stock.mint}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{stock.description.split("\n")[0]}</p>

        {pos && pos.shares !== 0 ? (
          <div className="mt-6 rounded-2xl bg-elevated px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-subtle uppercase">Your position</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {pos.shares > 0 ? "Long" : "Short"} {Math.abs(pos.shares).toFixed(4)}
            </p>
            <p className={cn("text-sm font-semibold tabular-nums", pnl < 0 ? "text-down" : "text-up")}>
              {pnl >= 0 ? "+" : ""}
              {pnl.toFixed(2)} · mtm {formatUsd(mtm)}
            </p>
          </div>
        ) : null}

        <section className="mt-8">
          <p className="px-1 pb-2 text-sm font-semibold">Options</p>
          <p className="px-1 pb-3 text-sm text-muted">
            Cash-or-nothing on token last. ATM call {atm ? `${Math.round(atm.ask * 100)}¢` : "—"}.
          </p>
          <OptionChain stock={stock} tenor={tenor} onTenor={setTenor} busy={busy} onBuy={(c) => setOpt(c)} />
        </section>

        <TokenRails stock={stock} />
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-bg/95 px-4 pt-3 pb-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            disabled={frozen || busy}
            onClick={() => setTicket("yes")}
            className="min-h-14 rounded-full bg-up text-base font-semibold text-up-fg disabled:opacity-50"
          >
            Buy
          </button>
          <button
            type="button"
            disabled={frozen || busy}
            onClick={() => setTicket("no")}
            className="min-h-14 rounded-full bg-down text-base font-semibold text-down-fg disabled:opacity-50"
          >
            {sellLabel}
          </button>
        </div>
      </div>

      {ticket ? (
        <OrderTicket
          stock={stock}
          side={ticket}
          spend={spend}
          onSpend={setSpend}
          cash={chips}
          busy={busy}
          onConfirm={() => void fill(ticket)}
          onClose={() => setTicket(null)}
        />
      ) : null}

      {opt ? (
        <OrderTicket
          stock={stock}
          side="yes"
          spend={spend}
          onSpend={setSpend}
          cash={chips}
          busy={busy}
          onConfirm={() => void liftOpt(opt)}
          onClose={() => setOpt(null)}
          subtitle={`${opt.kind === "call" ? "Call" : "Put"} strike ${formatStrike(opt.strike)} · debit ${Math.round(opt.ask * 100)}¢. Pays $1 if last is ${opt.kind === "call" ? "above" : "below"} strike at expiry.`}
          confirmLabel={`Buy ${opt.kind} · $${spend}`}
        />
      ) : null}
    </main>
  );
}
