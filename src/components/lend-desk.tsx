import { useState } from "react";
import { toast } from "sonner";
import { LTV, loadLoans, repay } from "@/lib/lend";
import { connectPhantom, splHolding } from "@/lib/phantom";
import { runPrestock, spendable } from "@/lib/prestock";
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
      const room = spendable(held.ui, h.last) * LTV;
      if (room < 1) {
        toast.error(`No ${h.symbol} in this wallet to draw against.`);
        return;
      }
      const done = await runPrestock({ owner, mint: h.mint, side: "sell", usd: room, price: h.last });
      toast.success(`Sold $${room.toFixed(2)} of ${h.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sale did not send.");
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
        Sell up to {Math.round(LTV * 100)}% of the {`PreStock`} this wallet actually holds. The USDC lands in the wallet. The rest of the token stays.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {names.map((h) => (
          <li key={h.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold">{h.symbol}</p>
              <p className="font-mono text-xs text-subtle">{formatUsd(h.last)} · draw is a sale, not a new loan</p>
            </div>
            <button type="button" onClick={() => void take(h)} className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
              Sell to spend
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
