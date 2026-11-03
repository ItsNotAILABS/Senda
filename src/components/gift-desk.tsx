import { useEffect, useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { fundGift, giftLink, loadGifts, markGift, newGift, saveGift, secretBytes, sweepGift, type GiftRecord } from "@/lib/gift-vault";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const WINDOWS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

export function GiftDesk() {
  const wallet = useWallet();
  const [usd, setUsd] = useState("25");
  const [memo, setMemo] = useState("");
  const [hours, setHours] = useState(24);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<GiftRecord[]>([]);

  useEffect(() => setRows(loadGifts()), []);

  async function create() {
    const amount = Number(usd);
    if (!(amount > 0)) {
      toast.error("Enter dollars.");
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
      const made = newGift(amount, memo, hours);
      const sig = await fundGift({ owner, vault: made.record.pubkey, usd: amount, memo: made.record.memo });
      saveGift(made.record);
      setRows(loadGifts());
      const absolute = `${window.location.origin}${made.link}`;
      setLink(absolute);
      try {
        await navigator.clipboard.writeText(absolute);
      } catch {
        /* the field still holds it */
      }
      toast.success(`Vault funded. ${sig.slice(0, 8)}… Link copied.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The gift did not fund.");
    } finally {
      setBusy(false);
    }
  }

  async function reclaim(row: GiftRecord) {
    setBusy(true);
    try {
      const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address || (await connectPhantom());
      const sig = await sweepGift({ secret: secretBytes(row.secret), to: owner });
      markGift(row.pubkey, "reclaimed");
      setRows(loadGifts());
      toast.success(`USDC returned. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reclaim did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-2xl tracking-tight">Gift</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        One link. You fund a fresh vault with USDC, plus a little SOL so the recipient pays no fee. The secret stays in the link and in this browser. Senda never holds it. The clock is this page, not a program — anyone who has the link can still move the USDC.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <input
          inputMode="decimal"
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
          placeholder="USDC"
          className="min-h-12 rounded-2xl bg-elevated px-4 font-mono text-lg outline-none"
        />
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Note, optional"
          maxLength={80}
          className="min-h-12 rounded-2xl bg-elevated px-4 text-sm outline-none"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.hours}
            type="button"
            onClick={() => setHours(w.hours)}
            className={hours === w.hours ? "min-h-10 rounded-full bg-fg px-4 text-xs font-semibold text-bg" : "min-h-10 rounded-full bg-elevated px-4 text-xs font-semibold text-muted"}
          >
            {w.label}
          </button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={() => void create()} className="mt-4 min-h-12 w-full rounded-full bg-fg text-sm font-semibold text-bg disabled:opacity-50">
        {busy ? "Waiting for the wallet…" : "Fund the vault and copy the link"}
      </button>
      {link ? (
        <p className="mt-3 break-all rounded-2xl bg-elevated px-4 py-3 font-mono text-[11px] text-subtle">{link}</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {rows.map((row) => (
            <li key={row.pubkey} className="rounded-2xl border border-white/10 px-4 py-3">
              <p className="text-sm font-semibold">
                ${row.usd.toFixed(2)} · {row.status}
              </p>
              <p className="mt-1 font-mono text-[11px] text-subtle">
                {row.pubkey.slice(0, 6)}…{row.pubkey.slice(-4)} · until {new Date(row.expiresAt).toLocaleString()}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="min-h-10 rounded-full bg-elevated px-4 text-xs font-semibold"
                  onClick={() => {
                    const absolute = `${window.location.origin}${giftLink(secretBytes(row.secret), row.expiresAt, row.usd, row.memo)}`;
                    void navigator.clipboard.writeText(absolute).then(
                      () => toast.success("Link copied."),
                      () => toast.error(absolute),
                    );
                  }}
                >
                  Copy link
                </button>
                {row.status === "open" ? (
                  <button type="button" disabled={busy} onClick={() => void reclaim(row)} className="min-h-10 rounded-full bg-fg px-4 text-xs font-semibold text-bg">
                    Reclaim
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
