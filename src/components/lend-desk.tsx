import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apyText, loadEarnBook, type EarnRow } from "@/lib/earn-book";
import { connectPhantom, splHolding } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { formatUsd, type HouseListing } from "@/lib/sol-house";

export function LendDesk({ house }: { house: HouseListing[] }) {
  const wallet = useWallet();
  const [busy, setBusy] = useState("");
  const [reserves, setReserves] = useState<EarnRow[]>([]);
  const names = house.filter((h) => h.venue === "prestocks" && h.last > 0);
  const kamino = [...reserves.filter((row) => !row.sign)].sort((a, b) => (a.symbol === "USDC" ? -1 : 0) - (b.symbol === "USDC" ? -1 : 0));

  useEffect(() => {
    let live = true;
    loadEarnBook()
      .then((rows) => live && setReserves(rows))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

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
        Kamino is the lending market. The rate and the dollars supplied are live. This page does not deposit, because a swap would not enter the reserve. Borrow, repay, and deposit are on Loans. Selling a pre-IPO name is separate, and only for a token this wallet already holds.
      </p>
      <Link to="/vault/loans" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-black">
        Open Loans
      </Link>
      <ul className="mt-3 divide-y divide-white/10">
        {kamino.slice(0, 8).map((row) => (
          <li key={row.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold">{row.symbol}</p>
              <p className="text-xs text-white/40">{row.tvlUsd >= 1_000_000 ? `$${(row.tvlUsd / 1_000_000).toFixed(1)}M supplied` : "Kamino"}</p>
            </div>
            <p className="font-mono text-sm">{apyText(row)}</p>
          </li>
        ))}
      </ul>
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
