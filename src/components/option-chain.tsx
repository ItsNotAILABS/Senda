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
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] border-b border-white/10 px-2 pb-2 font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">
            <p className="text-up">Calls</p>
            <p className="text-center">Strike</p>
            <p className="text-right text-down">Puts</p>
          </div>
          <div>
            {strikes.map((k) => {
              const call = rows.find((r) => r.strike === k && r.kind === "call");
              const put = rows.find((r) => r.strike === k && r.kind === "put");
              const atm = call?.atm || put?.atm;
              return (
                <div
                  key={k}
                  className={cn(
                    "grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/5 px-1",
                    atm && "bg-accent/10",
                  )}
                >
                  <button
                    type="button"
                    disabled={busy || !call}
                    onClick={() => call && onBuy(call)}
                    className="min-h-11 rounded-lg px-2 text-left font-mono text-sm font-semibold tabular-nums text-up hover:bg-up/15 disabled:opacity-40"
                  >
                    {call ? formatDebit(call.ask) : "—"}
                  </button>
                  <p className={cn("min-w-16 text-center font-mono text-sm font-semibold tabular-nums", atm ? "text-fg" : "text-muted")}>
                    {formatStrike(k)}
                    {atm ? <span className="block text-[9px] font-medium tracking-wide text-accent">ATM</span> : null}
                  </p>
                  <button
                    type="button"
                    disabled={busy || !put}
                    onClick={() => put && onBuy(put)}
                    className="min-h-11 rounded-lg px-2 text-right font-mono text-sm font-semibold tabular-nums text-down hover:bg-down/15 disabled:opacity-40"
                  >
                    {put ? formatDebit(put.ask) : "—"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="px-3 pt-2 text-xs leading-snug text-subtle">
            {stock.symbol} last {formatUsd(stock.last)}. The number is the debit. A call above the strike does not pay a profit. A put below the strike does not pay a profit. Close returns the debit until another wallet posts the payout.
          </p>
        </>
      )}
    </section>
  );
}
