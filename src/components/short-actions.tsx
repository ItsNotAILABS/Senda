import { useState } from "react";
import { toast } from "sonner";
import { shortBook, signMarketShort, type ShortBook } from "@/lib/short-market";
import { connectPhantom } from "@/lib/phantom";
import { connectWallet } from "@/lib/wallets";
import { rememberTrade } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** Market short of this name, and of the S&P. Collateral is the dollars. Nothing is borrowed on Solana. */
export function ShortActions({ symbol, usd, indexOnly = false }: { symbol: string; usd: number; indexOnly?: boolean }) {
  const wallet = useWallet();
  const name = indexOnly ? null : shortBook(symbol);
  const market = shortBook("US500");
  const [pick, setPick] = useState<ShortBook | null>(null);
  const [busy, setBusy] = useState(false);

  async function sign() {
    if (!pick) return;
    setBusy(true);
    try {
      const have = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = have || (await connectPhantom());
      if (!have) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Phantom.");
      }
      let trader = "";
      if (pick.kind === "base") {
        const evm = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
        trader = evm || (await connectWallet("metamask")).address;
        if (!evm) {
          const linked = wallet.linkChain(trader, "MetaMask", "evm");
          if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep MetaMask.");
        }
      }
      const done = await signMarketShort({ book: pick, usd, owner, trader });
      rememberTrade({ symbol: pick.label, side: "sell", usd, mint: "", signature: done.id });
      toast.success(`${pick.label} short is open on ${done.where}. ${done.id.slice(0, 8)}…`);
      setPick(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The short did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {pick ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
          <p className="text-sm font-semibold">Short {pick.label}</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">${usd || 0}</p>
          <p className="mt-1 text-xs text-white/50">
            Market. 2×. Collateral is these dollars.
            {pick.kind === "jup" ? " Phantom signs the Jupiter perpetual." : " MetaMask signs it on Base. It is not a Solana swap, and it does not borrow the token."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPick(null)} className="min-h-11 rounded-xl border border-white/15 text-sm">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void sign()} className="min-h-11 rounded-xl bg-[#e11d48] text-sm font-semibold text-white disabled:opacity-40">
              {busy ? "Waiting for the wallet…" : "Sign short"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {name ? (
            <button type="button" onClick={() => setPick(name)} className="min-h-11 rounded-xl bg-[#e11d48] text-sm font-semibold text-white">
              Short {symbol}
            </button>
          ) : indexOnly ? null : (
            <p className="text-xs text-white/40">No short market on {symbol}. Selling the token is not a short.</p>
          )}
          {market ? (
            <button type="button" onClick={() => setPick(market)} className="min-h-11 rounded-xl border border-[#e11d48]/50 text-sm font-semibold text-[#ff8fa0]">
              Short the market
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
