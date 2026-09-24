import { useState } from "react";
import { toast } from "sonner";
import { closePerp, fundingRate, loadPerps, openPerp, perpPnl, type PerpPos } from "@/lib/perp";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { formatMoney } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export function PerpDesk({
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
  const names = house.filter((h) => h.venue === "prestocks");
  const [stockId, setStockId] = useState(names[0]?.id ?? "");
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState(loadPerps);
  const notional = Number(raw) || 0;
  const stock = names.find((n) => n.id === stockId) ?? names[0];
  const fund = fundingRate(stock?.premium ?? 0);

  async function open(side: "long" | "short") {
    if (!stock || !(notional > 0)) {
      toast.error("Enter notional.");
      return;
    }
    const margin = notional * 0.2;
    if (cash < margin) {
      toast.error("Need 20% margin in cash.");
      return;
    }
    const d = await onDebit(margin, `perp ${stock.symbol}`);
    if (!d.ok) {
      toast.error(d.error);
      return;
    }
    setRows(openPerp(rows, stock.id, stock.symbol, side, notional, stock.last));
    toast.success(`${side} ${stock.symbol} ${formatMoney(notional)} perp`);
  }

  async function close(p: PerpPos) {
    const last = names.find((n) => n.id === p.stockId)?.last ?? p.entry;
    const pnl = perpPnl(p, last);
    const margin = p.notional * 0.2;
    const back = margin + pnl;
    if (back > 0) await onCredit(back, `perp close ${p.symbol}`);
    setRows(closePerp(rows, p.id));
    toast.success(`Closed ${p.symbol} · ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`);
  }

  return (
    <div className="px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        Perp on PreStocks last. 20% margin. Funding is premium-to-mark / 24h — longs pay when last is rich.
      </p>
      <select
        value={stock?.id ?? ""}
        onChange={(e) => setStockId(e.target.value)}
        className="mt-4 min-h-12 w-full rounded-2xl bg-elevated px-4 text-sm outline-none"
      >
        {names.map((n) => (
          <option key={n.id} value={n.id}>
            {n.symbol} · {formatUsd(n.last)} · {formatPremium(n.premium)} mark
          </option>
        ))}
      </select>
      {stock ? (
        <p className="mt-2 font-mono text-xs text-subtle">
          Funding {fund >= 0 ? "+" : ""}
          {(fund * 100).toFixed(3)}% / h · mint {stock.mint.slice(0, 8)}…
        </p>
      ) : null}
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Notional USD"
        className="mt-3 min-h-12 w-full rounded-2xl bg-elevated px-4 font-mono text-lg outline-none"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void open("long")} className="min-h-12 rounded-full bg-up text-sm font-semibold text-up-fg">
          Long
        </button>
        <button type="button" onClick={() => void open("short")} className="min-h-12 rounded-full bg-down text-sm font-semibold text-down-fg">
          Short
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">No perps open.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {rows.map((p) => {
            const last = names.find((n) => n.id === p.stockId)?.last ?? p.entry;
            const pnl = perpPnl(p, last);
            return (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {p.symbol} {p.side}
                  </p>
                  <p className="font-mono text-xs text-subtle">{formatMoney(p.notional)} @ {formatUsd(p.entry)}</p>
                </div>
                <div className="text-right">
                  <p className={cn("font-mono text-sm font-semibold", pnl < 0 ? "text-down" : "text-up")}>
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toFixed(2)}
                  </p>
                  <button type="button" onClick={() => void close(p)} className="text-xs text-muted">
                    Close
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
