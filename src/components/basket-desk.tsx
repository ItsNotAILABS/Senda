import { toast } from "sonner";
import { PACKS } from "@/lib/basket";
import { setIntent } from "@/lib/book";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { formatMoney } from "@/lib/wallet";
import { useState } from "react";

export function BasketDesk({ house }: { house: HouseListing[] }) {
  const wallet = useWallet();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const spend = Number(raw) || 0;
  const pre = house.filter((h) => h.venue === "prestocks");

  async function buy(packId: string) {
    const pack = PACKS.find((p) => p.id === packId);
    if (!pack || !(spend > 0)) {
      toast.error("Enter dollars.");
      return;
    }
    const legs = pack.symbols
      .map((s) => pre.find((h) => h.symbol.toUpperCase() === s || h.symbol.replace(/[-_]/g, "").toUpperCase().includes(s)))
      .filter((x): x is HouseListing => Boolean(x));
    if (legs.length < 2) {
      toast.error("Not enough names live for this pack.");
      return;
    }
    const each = Math.round((spend / legs.length) * 100) / 100;
    if (each < 0.5) {
      toast.error("Each name needs at least $0.50.");
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
      setIntent("hold");
      for (const leg of legs) {
        await runPrestock({ owner, mint: leg.mint, side: "buy", usd: each, price: leg.last });
      }
      toast.success(`Bought ${pack.name} · ${formatMoney(spend)}. Each name is in the wallet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pack did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        One size, split across the names, each bought with USDC. Jupiter builds every leg. Phantom signs each one.
      </p>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Dollars"
        className="mt-4 min-h-12 w-full rounded-2xl bg-elevated px-4 font-mono text-lg outline-none"
      />
      <ul className="mt-4 space-y-2">
        {PACKS.map((p) => {
          const legs = p.symbols
            .map((s) => pre.find((h) => h.symbol.toUpperCase().includes(s) || h.name.toUpperCase().includes(s)))
            .filter(Boolean);
          return (
            <li key={p.id} className="rounded-2xl bg-elevated px-4 py-4">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="mt-1 text-xs text-muted">
                {legs.map((l) => `${l!.symbol} ${formatUsd(l!.last)}`).join(" · ") || p.symbols.join(" · ")}
              </p>
              <button
                type="button"
                onClick={() => void buy(p.id)}
                disabled={busy}
                className="mt-3 min-h-11 w-full rounded-full bg-fg text-sm font-semibold text-bg disabled:opacity-50"
              >
                Buy pack
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
