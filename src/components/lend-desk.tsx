import { useState } from "react";
import { toast } from "sonner";
import { LANE } from "@/lib/explain";
import { LTV, loadLoans, borrow, repay } from "@/lib/lend";
import { connectPhantom, splHolding } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
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
  const wallet = useWallet();
  const [loans, setLoans] = useState(loadLoans);
  const names = house.filter((h) => h.venue === "prestocks" && h.last > 0);

  async function take(h: HouseListing) {
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const held = await splHolding(owner, h.mint);
      const full = Math.round(held.ui * h.last * LTV * 100) / 100;
      const already = loans.find((l) => l.stockId === h.id)?.borrowed ?? 0;
      const draw = Math.round((full - already) * 100) / 100;
      if (draw < 1) {
        toast.error(full < 1 ? `No ${h.symbol} in this wallet.` : `${h.symbol} is already drawn. The token is still there.`);
        return;
      }
      const credited = await onCredit(draw, `borrow ${h.symbol}`);
      if (!credited.ok) {
        toast.error(credited.error || "The loan did not credit.");
        return;
      }
      const next = borrow(loans, h.id, h.symbol, held.ui, h.last);
      if (!Array.isArray(next)) {
        toast.error(next.error);
        return;
      }
      setLoans(next);
      toast.success(`$${draw.toFixed(2)} against ${h.symbol}. You still hold it. Spending this does not sell it.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The loan did not open.");
    }
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
        Half of what this wallet holds, as cash you can spend. The PreStock does not move. You owe the cash back. Listed shares that Kamino already lends against stay on that market. This draw is the loan on the name you just bought.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-subtle">{LANE}</p>
      <ul className="mt-4 divide-y divide-border">
        {names.map((h) => (
          <li key={h.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold">{h.symbol}</p>
              <p className="font-mono text-xs text-subtle">{formatUsd(h.last)} · the token stays</p>
            </div>
            <button type="button" onClick={() => void take(h)} className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
              Borrow against it
            </button>
          </li>
        ))}
      </ul>
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
