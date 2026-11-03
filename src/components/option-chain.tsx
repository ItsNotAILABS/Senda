import { chainFor, formatDebit, formatStrike, TENORS, type OptContract, type OptTenor } from "@/lib/option-chain";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function OptionChain({
  stock,
  tenor,
  onTenor,
  busy,
  onBuy,
}: {
  stock: HouseListing | null;
  tenor: OptTenor;
  onTenor: (t: OptTenor) => void;
  busy?: boolean;
  onBuy: (c: OptContract) => void;
}) {
  const rows = stock ? chainFor(stock, tenor) : [];
  const strikes = [...new Set(rows.map((r) => r.strike))];

  return (
    <section className="flex flex-col">
      <div className="flex gap-1 px-1">
        {TENORS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTenor(t.id)}
            className={cn(
              "min-h-11 flex-1 rounded-full px-3 text-sm font-medium",
              tenor === t.id ? "bg-lime text-lime-fg" : "bg-elevated text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!stock ? (
        <p className="px-4 py-10 text-center text-sm text-muted">Pick a name.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] px-3 pb-1 font-medium text-xs tracking-wide text-subtle uppercase">
            <p>Call</p>
            <p className="text-center">Strike</p>
            <p className="text-right">Put · insure</p>
          </div>
          <div className="divide-y divide-border">
            {strikes.map((k) => {
              const call = rows.find((r) => r.strike === k && r.kind === "call");
              const put = rows.find((r) => r.strike === k && r.kind === "put");
              const atm = call?.atm || put?.atm;
              return (
                <div
                  key={k}
                  className={cn(
                    "grid grid-cols-[1fr_auto_1fr] items-center px-2 py-1",
                    atm && "bg-elevated/60",
                  )}
                >
                  <button
                    type="button"
                    disabled={busy || !call}
                    onClick={() => call && onBuy(call)}
                    className="min-h-11 rounded-full px-3 text-left text-sm font-semibold tabular-nums text-up hover:bg-up/10"
                  >
                    {call ? formatDebit(call.ask) : "—"}
                  </button>
                  <p
                    className={cn(
                      "min-w-16 text-center text-sm font-semibold tabular-nums",
                      atm ? "text-fg" : "text-muted",
                    )}
                  >
                    {formatStrike(k)}
                    {atm ? <span className="block text-[0.65rem] font-medium text-subtle">ATM</span> : null}
                  </p>
                  <button
                    type="button"
                    disabled={busy || !put}
                    onClick={() => put && onBuy(put)}
                    className="min-h-11 rounded-full px-3 text-right text-sm font-semibold tabular-nums text-down hover:bg-down/10"
                  >
                    {put ? formatDebit(put.ask) : "—"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="px-3 pt-2 text-xs leading-snug text-subtle">
            Cash-or-nothing on {stock.symbol} last {formatUsd(stock.last)}. σ from the 24h move. Paper.
            Tap a debit to lift.
          </p>
        </>
      )}
    </section>
  );
}
