import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { VaultAccounts } from "@/components/vault-accounts";
import { VaultSleeves } from "@/components/vault-sleeves";
import { SignCall } from "@/components/sign-call";
import { connectPhantom, pickOwner, readChain } from "@/lib/phantom";
import { sealState } from "@/lib/seal";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { unwrapUsdc, wrapUsdc, wrappedUsdc } from "@/lib/vault-wrap";
import { CCYS, formatMoney, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

/** The wallet book. Ciphertext until this Phantom signs. Not a second balance. */
export function VaultTab() {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = pickOwner(wallet.w.links) || link?.address || "";
  const [seal, setSeal] = useState(sealState());
  const [raw, setRaw] = useState("25");
  const [cap, setCap] = useState(100);
  const [name, setName] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState(false);
  const [usdc, setUsdc] = useState(0);
  const [rev, setRev] = useState(0);
  const wrapped = seal.open && owner ? wrappedUsdc(owner) + rev * 0 : 0;

  useEffect(() => setCap(spendCap()), [seal.open]);
  useEffect(() => {
    const sync = () => setSeal(sealState());
    window.addEventListener("senda-seal", sync);
    return () => window.removeEventListener("senda-seal", sync);
  }, []);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    void readChain(owner)
      .then((row) => {
        if (live) setUsdc(row.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [owner, seal.open]);

  async function unseal() {
    setBusy(true);
    try {
      const addr = await connectPhantom();
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Phantom did not stay.");
      toast.success("The vault is open for this visit.");
      setCall(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The vault stayed sealed.");
    } finally {
      setBusy(false);
    }
  }

  function wrap() {
    if (!seal.open || !owner) return toast.error("Sign Phantom before the vault will write.");
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
    toast.success(`Wrapped $${n.toFixed(2)}. It is still in the wallet.`);
  }

  function push() {
    if (!seal.open || !owner) return toast.error("Sign Phantom before the vault will write.");
    const n = Number(raw);
    if (!(n > 0)) return toast.error("Enter an amount.");
    if (n - wrapped > 0.001) return toast.error("Only wrapped USDC can be pushed back.");
    const r = wallet.release(n, link?.label || "Phantom");
    if (!r.ok) return toast.error(r.error);
    unwrapUsdc(owner, n);
    toast.success(`Pushed $${n.toFixed(2)} back.`);
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Vault</p>
          <h1 className="mt-1 text-3xl tracking-tight">The wallet book.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Every line this vault writes is AES-GCM. The key is this visit’s Phantom signature and it is not stored. Nothing here is a second balance. USDC stays in the wallet.</p>
        </div>
        <p className={cn("rounded-full px-3 py-1 text-xs font-semibold", seal.open ? "bg-accent text-accent-fg" : "bg-down/20 text-down")}>
          {seal.open ? "Sealed for this visit" : "Locked"}
        </p>
      </header>

      {seal.open ? null : (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-sm text-muted">The book is ciphertext. Phantom has to sign before a wrap, a pocket, or a fill can be read.</p>
          <button type="button" disabled={busy} onClick={() => setCall(true)} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy ? "Waiting on Phantom" : "Sign to open the vault"}
          </button>
        </section>
      )}
      <SignCall
        open={call || busy}
        wallet="Phantom"
        title="Open this vault"
        account={owner}
        waiting={busy}
        lines={[
          "Message: senda-vault:v1 and this address.",
          "Phantom may ask twice. Connect, then sign.",
          "The signature is the key for this visit. It is not stored.",
          "No SOL or USDC moves.",
        ]}
        onReject={() => {
          if (!busy) setCall(false);
        }}
        onSign={() => void unseal()}
      />

      <VaultAccounts owner={owner} />
      <VaultSleeves owner={owner} onChain={usdc} open={seal.open} onChange={() => setRev((n) => n + 1)} />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Wrapped</p>
          <p className="mt-2 font-mono text-3xl tabular-nums">{seal.open ? `$${wrapped.toFixed(2)}` : "—"}</p>
          <p className="mt-1 text-xs text-muted">A claim on USDC already in Phantom. Counted once.</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Send cap</p>
          <p className="mt-2 font-mono text-3xl tabular-nums">${cap}</p>
          <div className="mt-2 flex gap-1">
            {[25, 100, 500].map((n) => (
              <button key={n} type="button" onClick={() => setCap(setSpendCap(n))} className={cn("min-h-8 rounded-full px-2 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-white/10")}>
                ${n}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Pockets</p>
          <p className="mt-2 font-mono text-3xl tabular-nums">{seal.open ? wallet.w.vaults.length : "—"}</p>
          <p className="mt-1 text-xs text-muted">Named sleeves in the sealed book. Not a mint.</p>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Wrap</p>
        <p className="mt-1 text-sm text-muted">Marks dollars as held by this vault. Push returns the mark. The tokens do not move.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={raw} onChange={(e) => setRaw(e.target.value)} inputMode="decimal" aria-label="Amount" className="min-h-11 w-32 rounded-full border border-white/10 bg-black/40 px-4 font-mono text-sm" />
          <button type="button" disabled={!seal.open} onClick={wrap} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">Wrap</button>
          <button type="button" disabled={!seal.open} onClick={push} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40">Push back</button>
          <Link to="/phantom" className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-black">Phantom</Link>
          <Link to="/vault" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">Portfolio</Link>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Pockets</p>
        {seal.open ? (
          <ul className="mt-2 space-y-2">
            {wallet.w.vaults.length === 0 ? <li className="text-sm text-subtle">None yet.</li> : null}
            {wallet.w.vaults.map((v) => (
              <li key={v.id} className="flex items-baseline justify-between text-sm">
                <span>{v.name}</span>
                <span className="font-mono">{formatMoney(v.balance, v.ccy)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-subtle">Locked.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm" />
          <select value={ccy} onChange={(e) => setCcy(e.target.value as Ccy)} className="min-h-11 rounded-full border border-white/10 bg-black/40 px-3 text-sm">
            {CCYS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!seal.open}
            onClick={() => {
              const r = wallet.openVault(name, ccy);
              if (!r.ok) toast.error(r.error);
              else {
                setName("");
                toast.success("Pocket opened. It is in the sealed book.");
              }
            }}
            className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40"
          >
            Open pocket
          </button>
        </div>
      </section>
    </div>
  );
}
