import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { formatMoney } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export function OrderTicket({
  stock,
  side,
  spend,
  onSpend,
  cash,
  busy,
  onConfirm,
  onClose,
  subtitle,
  confirmLabel,
}: {
  stock: HouseListing;
  side: "yes" | "no";
  spend: number;
  onSpend: (n: number) => void;
  cash: number;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  subtitle?: string;
  confirmLabel?: string;
}) {
  const buy = side === "yes";
  const shares = stock.last > 0 ? spend / stock.last : 0;
  const prem = formatPremium(stock.premium);
  const broke = spend > cash + 1e-9;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium tracking-wide text-subtle uppercase">{buy ? "Buy" : "Sell"}</p>
        <h2 id="ticket-title" className="mt-1 text-2xl font-semibold tracking-tight">
          {stock.symbol}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Last {formatUsd(stock.last)} · mark {formatUsd(stock.mark)} · {prem} to mark
        </p>
        {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}

        <label className="mt-5 block">
          <span className="text-xs font-medium text-subtle">Dollars</span>
          <input
            inputMode="decimal"
            value={spend ? String(spend) : ""}
            onChange={(e) => onSpend(Number(e.target.value) || 0)}
            placeholder="0"
            className="mt-1 min-h-14 w-full rounded-2xl bg-elevated px-4 text-3xl font-semibold tabular-nums outline-none"
          />
        </label>
        <p className="mt-2 text-sm tabular-nums text-muted">
          {shares > 0 ? `${shares.toFixed(4)} shares at last` : "—"} · cash {formatMoney(cash)}
        </p>
        {broke ? <p className="mt-1 text-sm text-down">Not enough cash. Add money first.</p> : null}

        <button
          type="button"
          disabled={busy || broke || !(spend > 0)}
          onClick={onConfirm}
          className={cn(
            "mt-5 min-h-14 w-full rounded-full text-base font-semibold disabled:opacity-40",
            buy ? "bg-up text-up-fg" : "bg-down text-down-fg",
          )}
        >
          {confirmLabel ?? `${buy ? "Buy" : "Sell"} ${stock.symbol} · ${formatMoney(spend)}`}
        </button>
        <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full text-sm text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
