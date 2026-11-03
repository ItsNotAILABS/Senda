import { useState } from "react";
import { toast } from "sonner";
import { connectPhantom, splHolding } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { formatUsd, type HouseListing } from "@/lib/sol-house";

export function LendDesk({ house }: { house: HouseListing[] }) {
  const wallet = useWallet();
  const [busy, setBusy] = useState("");
  const names = house.filter((h) => h.venue === "prestocks" && h.last > 0);

  async function sellHalf(h: HouseListing) {
    setBusy(h.id);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const held = await splHolding(owner, h.mint);
      if (!(held.ui > 0)) throw new Error(`No ${h.symbol} in this wallet. There is no lending pool on this name.`);
      const usd = Math.max(1, Math.round(held.ui * h.last * 0.5 * 100) / 100);
      const done = await runPrestock({ owner, mint: h.mint, side: "sell", usd, price: h.last });
      toast.success(`Sold about half of ${h.symbol} for USDC. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sell did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        There is no lending pool for these names. Raising USDC means selling a slice of what this wallet already holds. You sign the Jupiter swap. The rest of the token stays. Kamino quotes for listed shares are on Listed, and they are not a loan from this page.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {names.map((h) => (
          <li key={h.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold">{h.symbol}</p>
              <p className="font-mono text-xs text-subtle">{formatUsd(h.last)} · sell half</p>
            </div>
            <button type="button" disabled={busy === h.id} onClick={() => void sellHalf(h)} className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
              {busy === h.id ? "Signing…" : "Sell half"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
