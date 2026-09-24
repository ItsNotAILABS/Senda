import { useState } from "react";
import { toast } from "sonner";
import { formatMoney, type Vault } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function VaultRow({ vault }: { vault: Vault }) {
  const w = useWallet();
  const [raw, setRaw] = useState("");
  const amt = Number(raw) || 0;

  return (
    <article className="border-b border-border px-5 py-4">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-medium">{vault.name}</p>
          <p className="text-xs text-subtle">Vault · {vault.ccy}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums">{formatMoney(vault.balance, vault.ccy)}</p>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="0"
          className="min-h-11 flex-1 rounded-2xl bg-elevated px-3 text-sm tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={() => {
            const r = w.vaultIn(vault.id, amt);
            if (!r.ok) toast.error(r.error);
            else setRaw("");
          }}
          className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold"
        >
          In
        </button>
        <button
          type="button"
          onClick={() => {
            const r = w.vaultOut(vault.id, amt);
            if (!r.ok) toast.error(r.error);
            else setRaw("");
          }}
          className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold"
        >
          Out
        </button>
      </div>
    </article>
  );
}
