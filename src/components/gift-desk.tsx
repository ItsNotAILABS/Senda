import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GIFT_WINDOWS, readGiftHash } from "@/lib/gift-link.mjs";
import { claimGift, fundGift, loadGifts, reclaimGift, type HeldGift } from "@/lib/gift-vault";
import { connectPhantom } from "@/lib/phantom";

export function GiftDesk() {
  const [usd, setUsd] = useState("25");
  const [hours, setHours] = useState(24);
  const [held, setHeld] = useState<HeldGift[]>([]);
  const [link, setLink] = useState("");
  const [incoming, setIncoming] = useState<ReturnType<typeof readGiftHash>>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeld(loadGifts());
    setIncoming(readGiftHash(window.location.hash));
  }, []);

  async function fund() {
    setBusy(true);
    try {
      const owner = await connectPhantom();
      const gift = await fundGift({ owner, usd: Number(usd), hours });
      setLink(gift.link);
      setHeld(loadGifts());
      toast.success("The vault is funded. Send the link.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The gift did not fund.");
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!incoming) return;
    setBusy(true);
    try {
      const to = await connectPhantom();
      const signature = await claimGift({ secret: incoming.secret, expiresAt: incoming.expiresAt, to, usd: incoming.usd });
      toast.success(`Claimed. ${signature.slice(0, 8)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The claim did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function reclaim(gift: HeldGift) {
    setBusy(true);
    try {
      const to = await connectPhantom();
      const signature = await reclaimGift({ secret: gift.secret, to, usd: gift.usd });
      toast.success(`Reclaimed. ${signature.slice(0, 8)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The reclaim did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        One link. You fund a vault from your wallet, and the gift key pays the network fee. The window is 1 hour, 1 day, or 7 days. The recipient connects a Solana wallet and claims. This page will not claim after the window, and you can reclaim what is left. The link is the vault key. It stays in the address hash and this tab. Senda does not hold it.
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <label className="block">
          <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">USDC</span>
          <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none" />
        </label>
        <div className="flex gap-2">
          {GIFT_WINDOWS.map((window) => (
            <button key={window.id} type="button" onClick={() => setHours(window.hours)} className={hours === window.hours ? "min-h-12 rounded-full bg-accent px-3 text-sm font-semibold text-accent-fg" : "min-h-12 rounded-full bg-white/10 px-3 text-sm"}>
              {window.label}
            </button>
          ))}
        </div>
        <button type="button" disabled={busy} onClick={() => void fund()} className="min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-40">
          Fund a gift
        </button>
      </div>
      {link ? (
        <p className="break-all font-mono text-xs text-muted">
          {link}
          <button
            type="button"
            className="ml-2 text-accent"
            onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copied."))}
          >
            Copy
          </button>
        </p>
      ) : null}
      {incoming ? (
        <button type="button" disabled={busy} onClick={() => void claim()} className="min-h-12 rounded-full bg-white px-5 text-sm font-semibold text-black disabled:opacity-40">
          Claim ${incoming.usd.toFixed(2)} into this wallet
        </button>
      ) : null}
      {held.length ? (
        <ul className="space-y-2">
          {held.map((gift) => (
            <li key={gift.vault} className="flex items-center justify-between gap-3 rounded-2xl bg-black/30 px-4 py-3">
              <span className="font-mono text-xs text-muted">
                ${gift.usd.toFixed(2)} · {gift.vault.slice(0, 4)}…{gift.vault.slice(-4)}
              </span>
              <button type="button" disabled={busy} onClick={() => void reclaim(gift)} className="text-sm font-semibold text-accent">
                Reclaim
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
