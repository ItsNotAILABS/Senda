import { useState } from "react";
import { toast } from "sonner";
import { openGooglePay } from "@/lib/browser-pay";
import { sealFunding } from "@/lib/card-mask";
import { connectPhantom, pickOwner } from "@/lib/phantom";
import { paySol, payUsdc } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

function formatPan(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

type CardLabel = { last4: string; network: string };

/** The card on this computer labels the payment. Phantom signs the USDC or the SOL. */
export function BrowserCard() {
  const wallet = useWallet();
  const [pan, setPan] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [card, setCard] = useState<CardLabel | null>(null);
  const [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState<"USDC" | "SOL">("USDC");
  const [amount, setAmount] = useState("1");
  const [to, setTo] = useState("");
  const [sig, setSig] = useState("");

  async function save() {
    const sealed = await sealFunding(pan, cvv);
    if ("error" in sealed) {
      toast.error(sealed.error);
      return;
    }
    const saved = wallet.addMasked(sealed.last4, exp, name, sealed.token);
    if (!saved.ok) {
      toast.error(saved.error);
      return;
    }
    setCard({ last4: sealed.last4, network: "Card" });
    setPan("");
    setCvv("");
    toast.success(`··${sealed.last4} is the label. It has not been charged.`);
  }

  async function google(usd: number) {
    setBusy(true);
    try {
      const got = await openGooglePay(usd);
      setCard(got);
      toast.success(`${got.network} ··${got.last4}. Google Pay was not charged.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The card sheet did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function spend() {
    if (!card) {
      toast.error("Open the card first. It labels the payment. It does not charge it.");
      return;
    }
    const n = Number(amount);
    if (!(n > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    setBusy(true);
    setSig("");
    try {
      const who = pickOwner(wallet.w.links) || (await connectPhantom());
      if (!wallet.w.links.some((l) => l.address === who)) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Phantom did not stay.");
      }
      const signature = asset === "USDC"
        ? (await payUsdc({ owner: who, to, usd: n, memo: `${card.network} ··${card.last4}` })).signature
        : await paySol({ owner: who, to, sol: n });
      setSig(signature);
      toast.success(`Signed. ··${card.last4} labeled it. The card was not charged.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">The card on this computer</p>
      <h2 className="mt-1 text-xl font-semibold">The card labels it. Phantom moves the money.</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Focus the number and this browser can offer the virtual card. Google Pay opens its own sheet. Neither one charges the card. After a last four is here, you can send USDC or SOL to an address. Phantom signs that.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="cc-name" placeholder="Name" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
        <input value={pan} onChange={(e) => setPan(formatPan(e.target.value))} autoComplete="cc-number" inputMode="numeric" placeholder="Card number" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        <input value={exp} onChange={(e) => setExp(e.target.value)} autoComplete="cc-exp" placeholder="MM/YY" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        <input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} autoComplete="cc-csc" inputMode="numeric" placeholder="CVV" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">Keep the last four</button>
        <button type="button" disabled={busy} onClick={() => void google(Math.max(1, Number(amount) || 1))} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">{busy ? "Opening" : "Open Google Pay"}</button>
      </div>
      {card ? <p className="mt-3 font-mono text-sm">{card.network} ··{card.last4} · not charged</p> : null}
      <div className="mt-4 rounded-2xl border border-white/10 p-3">
        <p className="text-sm font-semibold">Use this card on a payment</p>
        <p className="mt-1 text-xs text-subtle">The last four is the label on the signature. USDC leaves as USDC. SOL leaves as SOL.</p>
        <div className="mt-3 flex gap-1">
          {(["USDC", "SOL"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setAsset(id)} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", asset === id ? "bg-white text-black" : "bg-white/10")}>{id}</button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={asset === "SOL" ? "SOL" : "Dollars"} className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        </div>
        <button type="button" disabled={busy || !card} onClick={() => void spend()} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
          {card ? `Sign ${amount} ${asset} ··${card.last4}` : "Open a card first"}
        </button>
        {sig ? (
          <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-xs text-accent">
            {sig.slice(0, 12)}… on Solscan
          </a>
        ) : null}
      </div>
    </section>
  );
}