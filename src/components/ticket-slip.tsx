import { formatClock, remainingMs } from "@/lib/minute-book";
import { formatPays, type ParlayLeg } from "@/lib/parlay-book";
import { formatProb, formatRho, type ComboQuote } from "@/lib/combo-quote";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const BASKETS: Array<{ id: string; label: string; symbols: string[] }> = [
  { id: "ai", label: "AI", symbols: ["OPENAI", "ANTHROPIC"] },
  { id: "aero", label: "Aero", symbols: ["SPACEX", "ANDURIL"] },
  { id: "pred", label: "Pred", symbols: ["KALSHI", "POLYMARKET"] },
];

export function TicketSlip({
  slip,
  quote,
  spend,
  busy,
  onBasket,
  onSubmit,
  onClear,
}: {
  slip: ParlayLeg[];
  quote: ComboQuote | null;
  spend: number;
  busy: boolean;
  onBasket: (symbols: string[]) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const left = remainingMs(now);
  const urgent = left < 10_000;
  const notePx = quote ? spend / quote.fairPays : 0;

  return (
    <div className="sticky bottom-2 z-20 rounded-xl bg-elevated p-3 shadow-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[0.65rem] tracking-[0.16em] text-subtle uppercase">
            60s digital basket
          </p>
          <p className="text-xs text-muted">
            Payoff N×R iff every leg finishes the clock on the chosen side of open. Else 0.
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 font-display text-lg font-semibold tabular-nums leading-none",
            urgent && "clock-urgent",
          )}
        >
          {formatClock(left)}
        </p>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-1">
        {BASKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onBasket(b.symbols)}
            className="min-h-11 rounded-md bg-bg px-1 font-display text-xs font-semibold text-fg transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            {b.label}
          </button>
        ))}
      </div>
      {slip.length === 0 ? (
        <p className="text-sm text-muted">
          Above / below open on a name. Two-leg quote is a Bernoulli copula with signed ρ.
          Same-name loan + SPV is a wrapper stack — joint is not the product.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-fg">
            {slip
              .map((l) => `${l.symbol} ${l.side === "up" ? "above" : "below"} ${l.open.toFixed(2)}`)
              .join(" · ")}
          </p>
          {quote ? (
            <dl className="grid grid-cols-4 gap-2 font-mono text-[0.65rem] tabular-nums">
              <div>
                <dt className="text-subtle uppercase">Q</dt>
                <dd>{formatProb(quote.pJoint)}</dd>
              </div>
              <div>
                <dt className="text-subtle uppercase">Q⊥</dt>
                <dd className="text-muted">{formatProb(quote.pIndep)}</dd>
              </div>
              <div>
                <dt className="text-subtle uppercase">ρ̄</dt>
                <dd>{formatRho(quote.rho)}</dd>
              </div>
              <div>
                <dt className="text-subtle uppercase">Note</dt>
                <dd>{notePx.toFixed(2)}</dd>
              </div>
            </dl>
          ) : null}
          {quote?.warnings[0] ? <p className="text-xs leading-snug text-muted">{quote.warnings[0]}</p> : null}
          <p className="font-display text-xl font-semibold tabular-nums">
            {quote ? formatPays(quote.fairPays) : "—"}
            <span className="ml-2 font-mono text-[0.65rem] font-normal text-subtle">
              quoted R
              {quote ? ` · R⊥ ${formatPays(quote.naivePays)}` : ""}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || slip.length === 0}
              onClick={onSubmit}
              className="min-h-11 flex-1 rounded-lg bg-fg font-display text-sm font-semibold text-bg transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-50"
            >
              Lift {spend} @ {quote ? formatPays(quote.fairPays) : "—"}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 rounded-lg bg-bg px-4 text-sm text-muted hover:text-fg"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
