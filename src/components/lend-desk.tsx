import { useState } from "react";
import { toast } from "sonner";
import { loadHouseBook, markHouse } from "@/lib/house-paper";
import { LTV, borrow, loadLoans, repay } from "@/lib/lend";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { formatMoney } from "@/lib/wallet";

export function LendDesk({
  house,
  onCredit,
  onDebit,
}: {
  house: HouseListing[];
  onCredit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  onDebit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [loans, setLoans] = useState(loadLoans);
  const book = loadHouseBook();
  const longs = house.filter((h) => h.venue === "prestocks" && (book[h.id]?.shares ?? 0) > 0);

  async function take(h: HouseListing) {
    const pos = book[h.id];
    if (!pos || pos.shares <= 0) return;
    const r = borrow(loans, h.id, h.symbol, pos.shares, h.last);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    const amt = r[0]?.borrowed ?? 0;
    const c = await onCredit(amt, `borrow ${h.symbol}`);
    if (!c.ok) {
      toast.error(c.error);
      return;
    }
    setLoans(r);
    toast.success(`Borrowed ${formatMoney(amt)} vs ${h.symbol}`);
  }

  async function pay(id: string) {
    const loan = loans.find((l) => l.id === id);
    if (!loan) return;
    const d = await onDebit(loan.borrowed, `repay ${loan.symbol}`);
    if (!d.ok) {
      toast.error(d.error);
      return;
    }
    setLoans(repay(loans, id));
    toast.success("Repaid.");
  }

  return (
    <div className="px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        Borrow USDC against a long SPL PreStock. {Math.round(LTV * 100)}% LTV on token last. Position stays; cash
        comes in. Same idea as lending the token in DeFi — paper here, Jupiter size is live.
      </p>
      {longs.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">Buy a name first, then borrow against it.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {longs.map((h) => {
            const pos = book[h.id];
            const mtm = markHouse(pos, h.last);
            return (
              <li key={h.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold">{h.symbol}</p>
                  <p className="font-mono text-xs text-subtle">
                    {pos.shares.toFixed(4)} · mtm {formatUsd(mtm)} · room {formatMoney(mtm * LTV)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void take(h)}
                  className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold"
                >
                  Borrow
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {loans.length > 0 ? (
        <ul className="mt-6 divide-y divide-border">
          {loans.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-3">
              <p className="text-sm">
                {l.symbol} · {formatMoney(l.borrowed)}
              </p>
              <button type="button" onClick={() => void pay(l.id)} className="text-xs font-semibold text-muted">
                Repay
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
