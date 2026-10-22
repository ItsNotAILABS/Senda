import { useEffect, useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { Keypair } from "@solana/web3.js";
import { markGift, readGiftHash, sweepGift } from "@/lib/gift-vault";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function ClaimDesk() {
  const wallet = useWallet();
  const [payload, setPayload] = useState<ReturnType<typeof readGiftHash>>(null);
  const [ready, setReady] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPayload(readGiftHash(window.location.hash));
    setReady(true);
    const linked = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    if (linked) setTo(linked);
  }, [wallet.w.links]);

  const expired = Boolean(payload && payload.expiresAt > 0 && Date.now() > payload.expiresAt);

  async function claim() {
    if (!payload) return;
    if (expired) {
      toast.error("This page will not claim a gift after its window. The sender can reclaim. The link itself is not a program lock.");
      return;
    }
    const dest = to.trim();
    if (dest.length < 32) {
      toast.error("Paste the wallet that should receive the USDC.");
      return;
    }
    setBusy(true);
    try {
      const sig = await sweepGift({ secret: payload.secret, to: dest });
      markGift(Keypair.fromSecretKey(payload.secret).publicKey.toBase58(), "claimed");
      toast.success(`USDC is on its way. ${sig.slice(0, 8)}… You did not pay a fee.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The claim did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Gift</p>
      <h1 className="mt-2 text-4xl tracking-tight">Claim USDC</h1>
      {!ready ? (
        <p className="mt-3 text-sm text-muted">Reading the link…</p>
      ) : !payload ? (
        <p className="mt-3 text-sm text-muted">This link has no vault secret. Ask the sender for the full link, including the part after the hash.</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">
            ${payload.usd.toFixed(2)} USDC{payload.memo ? ` · ${payload.memo}` : ""}. The vault pays the fee. You only name the wallet that receives it.
            {expired ? " The window on this page has closed." : ` Open until ${new Date(payload.expiresAt).toLocaleString()}.`}
          </p>
          <p className="mt-2 text-xs text-subtle">
            The clock is this page, not a Solana program. Anyone holding the link can move the USDC. Senda never sees the secret.
          </p>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Your Solana address"
            className="mt-4 min-h-12 w-full rounded-2xl bg-elevated px-4 font-mono text-xs outline-none"
          />
          <button
            type="button"
            onClick={() => {
              void connectPhantom()
                .then((addr) => {
                  setTo(addr);
                  const linked = wallet.linkChain(addr, "Phantom", "phantom");
                  if (!linked.ok) toast.error(linked.error || "Could not keep the address.");
                })
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "No wallet in this window. Paste an address."));
            }}
            className="mt-2 min-h-10 rounded-full bg-elevated px-4 text-xs font-semibold"
          >
            Use the connected wallet
          </button>
          <button type="button" disabled={busy || expired} onClick={() => void claim()} className="mt-4 min-h-12 w-full rounded-full bg-fg text-sm font-semibold text-bg disabled:opacity-50">
            {expired ? "Window closed" : busy ? "Sending…" : "Claim to this address"}
          </button>
        </>
      )}
    </div>
  );
}
