import { useState } from "react";
import { toast } from "sonner";
import { dropHeld, dropTrade, holdSend, listHeld, listHeldTrades, markSigned, markTradeSigned, netOpen, type HeldSend, type HeldTrade } from "@/lib/offline-rail";
import { payUsdc } from "@/lib/solana-pay";
import { connectPhantom, sendVersioned } from "@/lib/phantom";
import { signStockSwap } from "@/lib/jup-sign";
import { launchTrade } from "@/lib/launch";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** Hold a USDC send with no network. The link is ready. USDC moves only when a wallet signs. */
export function OfflineRail() {
  const wallet = useWallet();
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState("");
  const [memo, setMemo] = useState("");
  const [rows, setRows] = useState<HeldSend[]>(() => (typeof window === "undefined" ? [] : listHeld()));
  const [trades, setTrades] = useState<HeldTrade[]>(() => (typeof window === "undefined" ? [] : listHeldTrades()));
  const [busy, setBusy] = useState("");
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const nets = netOpen();

  function refresh() {
    setRows(listHeld());
    setTrades(listHeldTrades());
  }

  function hold() {
    const saved = holdSend(to, Number(usd), memo);
    if ("error" in saved) {
      toast.error(saved.error);
      return;
    }
    setUsd("");
    setMemo("");
    refresh();
    toast.success(online ? "Held. You can sign it now, or leave it until the network is back." : "Held offline. Nothing was sent.");
  }

  async function sign(ids: string[], dest: string, amount: number, note: string) {
    setBusy(ids[0] || dest);
    try {
      const have = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const who = have || (await connectPhantom());
      const paid = await payUsdc({ owner: who, to: dest, usd: amount, memo: note || undefined });
      markSigned(ids, paid.signature);
      refresh();
      toast.success(`Signed. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign. The hold is still here.");
    } finally {
      setBusy("");
    }
  }

  const open = rows.filter((row) => row.status === "held");
  const openTrades = trades.filter((row) => row.status === "held");

  async function signTrade(row: HeldTrade) {
    if (!online) {
      toast.error("The network is down. The trade stays held.");
      return;
    }
    setBusy(row.id);
    try {
      const have = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const who = have || (await connectPhantom());
      let sig = "";
      if (row.kind === "curve") {
        const bytes = await launchTrade({ owner: who, mint: row.mint, sol: row.sol, side: row.side, pool: row.pool });
        const { VersionedTransaction } = await import("@solana/web3.js");
        sig = await sendVersioned(VersionedTransaction.deserialize(bytes));
      } else {
        const done = await signStockSwap({
          owner: who,
          mint: row.mint,
          side: row.side,
          usd: row.usd,
          decimals: row.decimals,
          refPrice: row.price,
          symbol: row.symbol,
        });
        sig = done.signature;
      }
      markTradeSigned(row.id, sig);
      refresh();
      toast.success(`Signed. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign. The trade is still held.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Offline send</p>
        <p className="font-mono text-[11px] text-white/40">{online ? "Network up" : "Network down"}</p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-white/45">
        The engine nets the amount and writes the Solana Pay link on this phone. USDC does not move until you sign. A down network only blocks the signature.
      </p>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Address" spellCheck={false} className="mt-3 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-xs outline-none" />
      <div className="mt-2 flex gap-2">
        <input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="USDC" aria-label="Offline amount" className="min-h-11 w-28 rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-sm outline-none" />
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What it's for" className="min-h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
      </div>
      <button type="button" onClick={hold} className="mt-2 min-h-11 w-full rounded-2xl bg-white text-sm font-semibold text-black">
        Hold on this phone
      </button>
      {nets.length ? (
        <ul className="mt-3 space-y-2">
          {nets.map((leg) => (
            <li key={leg.to} className="rounded-2xl bg-white/[0.04] p-3">
              <p className="text-sm font-semibold">${leg.usd.toFixed(2)} USDC</p>
              <p className="mt-1 break-all font-mono text-[10px] text-white/40">{leg.to}</p>
              <p className="mt-1 text-[11px] text-white/45">{leg.ids.length > 1 ? `${leg.ids.length} holds, one signature.` : "One hold."} Not sent.</p>
              <button
                type="button"
                disabled={busy !== ""}
                onClick={() => void sign(leg.ids, leg.to, leg.usd, leg.memo)}
                className="mt-2 min-h-10 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
              >
                {busy ? "Waiting on the wallet" : online ? `Sign $${leg.usd.toFixed(2)}` : "Network down. Hold stays."}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open.length ? (
        <ul className="mt-3 divide-y divide-white/10">
          {open.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="block font-mono text-xs">${row.usd.toFixed(2)}</span>
                <span className="block text-[11px] text-white/35">{row.memo || row.at.slice(11, 16)}</span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(row.link).then(() => toast.success("Link copied. Their wallet can pay it."))}
                  className="min-h-9 rounded-full bg-white/10 px-3 text-xs"
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dropHeld(row.id);
                    refresh();
                  }}
                  className="min-h-9 rounded-full px-2 text-xs text-white/40"
                >
                  Drop
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-white/35">Nothing held.</p>
      )}
      {openTrades.length ? (
        <ul className="mt-3 space-y-2">
          {openTrades.map((row) => (
            <li key={row.id} className="rounded-2xl bg-white/[0.04] p-3">
              <p className="text-sm font-semibold">{row.side === "buy" ? "Buy" : "Sell"} {row.symbol}</p>
              <p className="mt-1 text-[11px] text-white/45">
                {row.kind === "curve" ? `${row.sol} SOL on ${row.pool}` : `$${row.usd.toFixed(2)} USDC`}
                {row.price > 0 ? ` · last $${row.price}` : ""}. Not filled.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy !== ""} onClick={() => void signTrade(row)} className="min-h-10 flex-1 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
                  {busy === row.id ? "Waiting" : online ? "Sign it" : "Network down"}
                </button>
                <button type="button" onClick={() => { dropTrade(row.id); refresh(); }} className="min-h-10 rounded-full px-3 text-xs text-white/40">Drop</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
