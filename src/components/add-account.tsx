import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { CCY_META, CCYS, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { WalletPicker } from "@/components/wallet-picker";
import { shortPk } from "@/lib/senda-keys";

export function AddAccountScreen({ onClose }: { onClose: () => void }) {
  const w = useWallet();
  const [vaultName, setVaultName] = useState("");
  const [vaultCcy, setVaultCcy] = useState<Ccy>("USD");
  const [addr, setAddr] = useState("");
  const opened = w.w.opened ?? ["USD"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg text-fg">
      <div className="mx-auto flex h-dvh w-full max-w-lg flex-col px-4 pt-3 pb-6">
        <header className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-elevated" aria-label="Close">
            <X className="size-4" strokeWidth={1.75} />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold">Add an account</h1>
          <span className="size-11" />
        </header>
        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <section>
            <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Hold a currency</p>
            <p className="mb-3 text-sm text-muted">
              Opens a balance. Money stays there — hedge, get paid, spend later. Exchange is mid-market, no weekend markup.
            </p>
            <ul className="overflow-hidden rounded-2xl bg-elevated">
              {CCYS.filter((c) => c !== "USD").map((c, i) => {
                const on = opened.includes(c);
                return (
                  <li key={c} className={i > 0 ? "border-t border-border" : undefined}>
                    <button
                      type="button"
                      disabled={on}
                      onClick={() => {
                        const r = w.openCurrency(c);
                        if (!r.ok) toast.error(r.error);
                        else toast.success(`Holding ${CCY_META[c].name}.`);
                      }}
                      className="flex min-h-16 w-full items-center gap-3 px-4 text-left disabled:opacity-50"
                    >
                      <span className="grid size-10 place-items-center rounded-full bg-bg text-xs font-semibold">{c}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{CCY_META[c].name}</span>
                        <span className="block text-xs text-muted">
                          {CCY_META[c].kind === "crypto"
                            ? c === "USDC"
                              ? "1:1 with USD · Solana"
                              : "Live Jupiter price"
                            : "Hold · convert when you want"}
                        </span>
                      </span>
                      <span className="text-xs text-subtle">{on ? "Holding" : "Hold"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <button
            type="button"
            disabled={Boolean(w.w.senda)}
            onClick={() => {
              const r = w.createWallet();
              if (!r.ok) toast.error(r.error);
              else toast.success("Senda Solana wallet issued on this device.");
            }}
            className="min-h-16 rounded-2xl bg-elevated px-4 text-left disabled:opacity-40"
          >
            <span className="block text-sm font-semibold">Create a Senda wallet</span>
            <span className="block text-xs text-muted">
              {w.w.senda ? shortPk(w.w.senda.pubkey) : "Use Phantom. Senda does not keep a key."}
            </span>
          </button>

          <section className="rounded-2xl bg-elevated px-4 py-4">
            <WalletPicker />
          </section>

          <form
            className="rounded-2xl bg-elevated px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              const r = w.linkChain(addr, "Solana", "solana");
              if (!r.ok) toast.error(r.error);
              else {
                w.openCurrency("SOL");
                toast.success("Linked.");
                setAddr("");
              }
            }}
          >
            <p className="text-sm font-semibold">Paste a Solana address</p>
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="Address"
              className="mt-2 min-h-12 w-full rounded-2xl bg-bg px-4 font-mono text-sm outline-none placeholder:text-subtle"
            />
            <button type="submit" className="mt-3 min-h-11 w-full rounded-full bg-fg text-sm font-semibold text-bg">
              Link address
            </button>
          </form>

          <form
            className="rounded-2xl bg-elevated px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              const r = w.openVault(vaultName, vaultCcy);
              if (!r.ok) toast.error(r.error);
              else {
                toast.success(`Vault ${vaultName}`);
                setVaultName("");
              }
            }}
          >
            <p className="text-sm font-semibold">New vault</p>
            <p className="mt-1 text-xs text-muted">Park a currency. Same cash, labeled.</p>
            <input
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="Name"
              className="mt-2 min-h-12 w-full rounded-2xl bg-bg px-4 text-sm outline-none placeholder:text-subtle"
            />
            <select
              value={vaultCcy}
              onChange={(e) => setVaultCcy(e.target.value as Ccy)}
              className="mt-2 min-h-12 w-full rounded-2xl bg-bg px-4 text-sm outline-none"
            >
              {opened.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" className="mt-3 min-h-11 w-full rounded-full bg-fg text-sm font-semibold text-bg">
              Create vault
            </button>
          </form>
        </div>
        <button type="button" onClick={onClose} className="mt-4 min-h-12 shrink-0 rounded-full bg-fg text-base font-semibold text-bg">
          Done
        </button>
      </div>
    </div>
  );
}