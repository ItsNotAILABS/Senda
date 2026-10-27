import { useState } from "react";
import { toast } from "sonner";
import { deskFeeLine } from "@/lib/desk-fee";
import { USDC } from "@/lib/jup-exec";
import { placeLimit } from "@/lib/jup-limit";
import { connectPhantom, mintDecimals } from "@/lib/phantom";

/** A Jupiter trigger order at a price. It rests. It is not a market fill. */
export function RestTicket({
  mint,
  symbol,
  price,
  usd,
  side,
}: {
  mint: string;
  symbol: string;
  price: number;
  usd: number;
  side: "buy" | "sell";
}) {
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(String(price > 0 ? price : ""));

  async function sign() {
    const px = Number(limit);
    if (!mint || !(px > 0) || !(usd > 0)) {
      toast.error("Need a mint, a limit, and a size.");
      return;
    }
    setBusy(true);
    try {
      const who = await connectPhantom();
      const decimals = await mintDecimals(mint);
      const tokens = BigInt(Math.max(1, Math.floor((usd / px) * 10 ** decimals)));
      const usdc = String(Math.max(1, Math.round(usd * 1_000_000)));
      const done = await placeLimit(
        side === "buy"
          ? { maker: who, inputMint: USDC, outputMint: mint, makingAmount: usdc, takingAmount: tokens.toString() }
          : { maker: who, inputMint: mint, outputMint: USDC, makingAmount: tokens.toString(), takingAmount: usdc },
      );
      toast.success(`${symbol} ${side} rests at ${px}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The limit did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-white/10 px-2 py-2">
      <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Rest · {symbol}</p>
      <p className="mt-1 text-[11px] leading-snug text-white/45">
        {side === "buy" ? "Pays USDC. Jupiter rests it until the market offers this many tokens." : "Pays the token. Jupiter rests it until the market pays this USDC."} Not a fill.
      </p>
      <label className="mt-2 block text-[10px] text-white/40">
        Limit
        <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2 font-mono text-sm outline-none" />
      </label>
      <p className="mt-1 text-[10px] leading-snug text-white/35">{deskFeeLine(usd)}</p>
      <button type="button" disabled={busy || !mint} onClick={() => void sign()} className="mt-2 min-h-10 w-full rounded-xl bg-white text-xs font-semibold text-black disabled:opacity-40">
        {busy ? "Waiting for Phantom…" : `Sign ${side} $${usd || 0}`}
      </button>
    </div>
  );
}
