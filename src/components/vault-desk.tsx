import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { WalletPicker } from "@/components/wallet-picker";
import { readChain } from "@/lib/phantom";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { unwrapUsdc, wrapUsdc, wrappedUsdc } from "@/lib/vault-wrap";
import { CCYS, formatMoney, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function VaultDesk() {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = link?.address ?? "";
  const [usdc, setUsdc] = useState(0);
  const [tick, setTick] = useState(0);
  const [raw, setRaw] = useState("25");
  const [cap, setCap] = useState(100);
  const [name, setName] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const wrapped = owner ? wrappedUsdc(owner) : 0;

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((s) => live && setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0))
      .catch(() => live && setUsdc(0));
    return () => {
      live = false;
    };
  }, [owner, tick]);

  function wrap() {
    if (!owner) return;
    const n = Number(raw);
    if (!(n > 0)) return toast.error("Enter an amount.");
    try {
      wrapUsdc(owner, link?.label || "Wallet", n, usdc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not wrap.");
      return;
    }
    const r = wallet.add(n, "USD", "usdc");
    if (!r.ok) {
      unwrapUsdc(owner, n);
      toast.error(r.error);
      return;
    }
    setTick((t) => t + 1);
    toast.success(`Wrapped $${n.toFixed(2)}. It is still in the wallet.`);
  }

  function push() {
    if (!owner) return;
    const n = Number(raw);
    if (!(n > 0)) return toast.error("Enter an amount.");
    if (n - wrapped > 0.001) return toast.error("Only wrapped USDC can be pushed back.");
    const r = wallet.release(n, link?.label || "Phantom");
    if (!r.ok) return toast.error(r.error);
    unwrapUsdc(owner, n);
    setTick((t) => t + 1);
    toast.success(`Pushed $${n.toFixed(2)} back to the wallet.`);
  }

  return (
    <main className="px-6 py-8 lg:px-10">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Vault</p>
      <h1 className="mt-2 max-w-2xl text-4xl">The wallet stays the wallet.</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        A wrap is a claim on USDC that never leaves Phantom. Senda cash is that claim. Push sends the claim back. Agents can only send inside the cap.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs text-subtle">On-chain USDC</p>
          <p className="mt-1 font-mono text-3xl">{owner ? `$${usdc.toFixed(2)}` : "—"}</p>
          <p className="mt-2 text-xs text-muted">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "No wallet connected."}</p>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs text-subtle">Wrapped</p>
          <p className="mt-1 font-mono text-3xl text-accent">${wrapped.toFixed(2)}</p>
          <p className="mt-2 text-xs text-muted">Still sitting in the wallet. Counted once.</p>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs text-subtle">Send cap</p>
          <p className="mt-1 font-mono text-3xl">${cap}</p>
          <div className="mt-3 flex gap-1">
            {[25, 100, 500].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCap(setSpendCap(n))}
                className={cn("min-h-8 rounded-lg px-2 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-elevated text-muted")}
              >
                ${n}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 max-w-xl">
        {owner ? (
          <>
            <input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="decimal"
              className="min-h-11 w-full rounded-lg bg-elevated px-3 font-mono outline-none"
              aria-label="Amount"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={wrap} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg">
                Wrap
              </button>
              <button type="button" onClick={push} className="min-h-11 rounded-lg bg-elevated px-4 text-sm font-semibold">
                Push back
              </button>
              <Link to="/agents" className="inline-flex min-h-11 items-center px-3 text-sm text-muted">
                Fund an agent inside the cap
              </Link>
            </div>
          </>
        ) : (
          <WalletPicker />
        )}
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="text-lg">Cash vaults</h2>
        <p className="mt-1 text-sm text-muted">A named pocket of Senda cash. It is not a second wallet and it does not mint USDC.</p>
        <ul className="mt-3 divide-y divide-border">
          {wallet.w.vaults.length === 0 ? <li className="py-3 text-sm text-subtle">None yet.</li> : null}
          {wallet.w.vaults.map((v) => (
            <li key={v.id} className="flex items-baseline justify-between py-3 text-sm">
              <span>{v.name}</span>
              <span className="font-mono">{formatMoney(v.balance, v.ccy)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="min-h-11 flex-1 rounded-lg bg-elevated px-3 text-sm outline-none"
          />
          <select value={ccy} onChange={(e) => setCcy(e.target.value as Ccy)} className="min-h-11 rounded-lg bg-elevated px-2 text-sm">
            {CCYS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const r = wallet.openVault(name, ccy);
              if (!r.ok) toast.error(r.error);
              else {
                setName("");
                toast.success("Vault opened.");
              }
            }}
            className="min-h-11 rounded-lg bg-fg px-4 text-sm font-semibold text-bg"
          >
            Open
          </button>
        </div>
      </section>
    </main>
  );
}
