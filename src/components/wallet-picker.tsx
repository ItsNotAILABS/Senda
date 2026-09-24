import { useState } from "react";
import { toast } from "sonner";
import { connectWallet, detectWallets, type WalletChoice } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { shortPk } from "@/lib/senda-keys";
import { cn } from "@/lib/utils";

export function WalletPicker() {
  const w = useWallet();
  const [choices, setChoices] = useState<WalletChoice[]>(() => detectWallets());
  const [busy, setBusy] = useState<string | null>(null);
  const installed = choices.filter((c) => c.installed);
  const missing = choices.filter((c) => !c.installed);

  async function go(c: WalletChoice) {
    if (!c.installed) {
      toast.error(`Open this page in a browser that has ${c.name}.`);
      return;
    }
    setBusy(c.id);
    try {
      const got = await connectWallet(c.id);
      const kind = got.chain === "evm" ? "evm" : c.id === "phantom" ? "phantom" : "solana";
      const r = w.linkChain(got.address, got.label, kind);
      if (!r.ok) toast.error(r.error);
      else {
        if (got.chain === "solana") w.openCurrency("SOL");
        toast.success(`${got.label} · ${shortPk(got.address)}`);
        setChoices(detectWallets());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold">Wallets you already have</p>
      <p className="mt-1 text-xs text-muted">Phantom, Solflare, Backpack, MetaMask, Rabby, Coinbase, Brave. We store the address. Not the key.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {(installed.length ? installed : choices).map((c) => {
          const linked = w.w.links.some((l) => l.label === c.name);
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void go(c)}
                className={cn(
                  "flex min-h-14 w-full items-center justify-between rounded-xl bg-bg px-3 text-left",
                  !c.installed && "opacity-60",
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted">{c.chain === "solana" ? "Solana" : "Ethereum"}</span>
                </span>
                <span className="text-xs text-subtle">
                  {busy === c.id ? "…" : linked ? "Linked" : c.installed ? "Connect" : "Not here"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {installed.length > 0 && missing.length > 0 ? (
        <p className="mt-2 text-xs text-subtle">Also works with {missing.map((m) => m.name).join(", ")} when that extension is installed.</p>
      ) : null}
    </div>
  );
}
