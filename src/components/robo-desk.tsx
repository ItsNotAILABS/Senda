import { useMemo, useState } from "react";
import { SHIPPED } from "@/lib/advisors";
import { runAdvisor } from "@/lib/advisors/engine";
import type { AdvisorOrder } from "@/lib/advisors/types";
import { spendCap } from "@/lib/spend-cap";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function RoboDesk({
  names,
  busy,
  onSign,
  onOpenForge,
}: {
  names: HouseListing[];
  busy: boolean;
  onSign: (order: AdvisorOrder) => void;
  onOpenForge?: () => void;
}) {
  const [budget, setBudget] = useState(100);
  const cap = spendCap();
  const room = Math.min(budget, cap);
  const runs = useMemo(
    () => SHIPPED.map((spec) => ({
      spec,
      trader: runAdvisor(spec, names, budget, cap, { split: "one" }),
      sleeve: runAdvisor(spec, names, budget, cap, { split: "equal" }),
    })),
    [names, budget, cap],
  );
  const traders = runs.filter((row) => row.trader.orders.length > 0);
  const sleeves = runs.filter((row) => row.spec.split === "equal" && row.sleeve.orders.length > 1);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">Robo</p>
      <h1 className="mt-1 text-2xl font-semibold">Advisors and traders</h1>
      <p className="mt-2 max-w-xl text-sm text-white/50">
        These are the shipped files. An update replaces one of them. It does not touch a file you saved in Forge. Nothing sends until you press sign. The cap is ${cap}.
      </p>
      {onOpenForge ? (
        <button type="button" onClick={onOpenForge} className="mt-3 min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Open Forge
        </button>
      ) : null}
      <label className="mt-4 block max-w-xs text-xs text-white/45">
        Budget
        <input
          value={budget}
          onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
          inputMode="decimal"
          className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 font-mono text-sm text-white"
        />
      </label>
      <p className="mt-2 font-mono text-xs text-white/40">Usable ${room.toFixed(2)} · {SHIPPED.length} shipped files</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {traders.map((row) => {
          const order = row.trader.orders[0];
          return (
            <section key={row.spec.id} className="rounded-2xl border border-white/10 bg-black p-4">
              <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Trader · v{row.spec.version}</p>
              <p className="mt-1 text-sm font-semibold">{row.spec.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{row.spec.line}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm">
                  {order.side === "buy" ? "Buy" : "Sell"} {order.symbol}
                  <span className="ml-2 font-mono text-[11px] text-white/40">
                    {formatUsd(order.last)} · {(order.premium * 100).toFixed(1)}% · ${order.usd.toFixed(2)}
                  </span>
                </span>
                <button type="button" disabled={busy || !(order.usd > 0)} onClick={() => onSign(order)} className="min-h-9 shrink-0 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">
                  Sign
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {sleeves.map((row) => (
          <section key={`${row.spec.id}-sleeve`} className="rounded-2xl border border-white/10 bg-[#101114] p-4">
            <p className="text-sm font-semibold">{row.spec.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">{row.spec.line}</p>
            <ul className="mt-3 space-y-2">
              {row.sleeve.orders.map((order) => (
                <li key={`${row.spec.id}-${order.mint}-${order.side}`} className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {order.side === "buy" ? "Buy" : "Sell"} {order.symbol}
                    <span className="ml-2 font-mono text-[11px] text-white/40">
                      {formatUsd(order.last)} · {(order.premium * 100).toFixed(1)}% · ${order.usd.toFixed(2)}
                    </span>
                  </span>
                  <button type="button" disabled={busy || !(order.usd > 0)} onClick={() => onSign(order)} className={cn("min-h-9 shrink-0 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40")}>
                    Sign
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {traders.length === 0 ? <p className="mt-4 text-sm text-white/45">Nothing on this book passed the shipped files.</p> : null}
    </div>
  );
}
