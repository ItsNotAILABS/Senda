import { useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function FillButton({
  mint,
  usd = 10,
  side = "buy",
  price,
  label,
  className,
}: {
  mint: string;
  usd?: number;
  side?: "buy" | "sell";
  price?: number;
  label: string;
  className?: string;
}) {
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);

  async function go() {
    if (mint.length < 32) {
      toast.error("That name has no on-chain mint.");
      return;
    }
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({ owner, mint, side, usd, price });
      toast.success(`Sent ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy} onClick={() => void go()} className={className}>
      {busy ? "Waiting for the wallet…" : label}
    </button>
  );
}
