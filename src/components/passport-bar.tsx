import { useEffect, useState } from "react";
import { toast } from "sonner";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { sealOpen, unlockSeal } from "@/lib/seal";
import { connectPhantom } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const CAPS = [25, 100, 500, 2500] as const;

/** The vault door. Phantom signs `senda-vault:v1`. That signature opens this browser. It does not move tokens. */
export function PassportBar() {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const [open, setOpen] = useState(false);
  const [cap, setCap] = useState(100);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOpen(sealOpen());
    setCap(spendCap());
    const sync = () => setOpen(sealOpen());
    window.addEventListener("senda-seal", sync);
    return () => window.removeEventListener("senda-seal", sync);
  }, []);

  async function openPassport() {
    setBusy(true);
    try {
      const who = link?.address || (await connectPhantom());
      if (!link) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      await unlockSeal(who);
      setOpen(true);
      toast.success("Passport open. This browser can read the vault.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign the passport.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#10131c] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Passport</p>
          <p className="mt-0.5 text-sm">
            {open ? "Open" : "Sealed"}
            <span className="text-muted"> · cap ${cap.toLocaleString("en-US")}</span>
            {link ? <span className="font-mono text-xs text-muted"> · {link.address.slice(0, 4)}…{link.address.slice(-4)}</span> : null}
          </p>
        </div>
        {open ? null : (
          <button type="button" disabled={busy} onClick={() => void openPassport()} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">
            {busy ? "Waiting on Phantom" : "Sign the passport"}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {CAPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCap(setSpendCap(n))}
            className={`min-h-8 rounded-full px-3 font-mono text-[11px] ${cap === n ? "bg-accent text-accent-fg" : "border border-white/10 text-muted"}`}
          >
            ${n}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-subtle">The signature opens this browser’s vault. It does not move tokens. The cap is the most one trade may send.</p>
    </section>
  );
}
