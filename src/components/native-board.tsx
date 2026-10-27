import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadNativeMarks, type NativeMark } from "@/lib/native-marks";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function money(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

/** Twenty-one marks. A buy exists only where a Solana token exists. A price is not a chain. */
export function NativeBoard() {
  const [rows, setRows] = useState<NativeMark[]>([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    loadNativeMarks().then(setRows).catch(() => setRows([]));
  }, []);

  const chains = rows.filter((r) => r.kind === "chain").length;
  const wrapped = rows.filter((r) => r.kind === "wrapped").length;
  const prices = rows.filter((r) => r.kind === "price").length;

  async function buy(row: NativeMark) {
    if (!row.mint) return;
    setBusy(row.symbol);
    try {
      const owner = await connectPhantom();
      await signRoute({
        owner,
        inputMint: USDC,
        outputMint: row.mint,
        amountRaw: 10_000_000,
        outDecimals: row.decimals,
        inDecimals: 6,
        usd: 10,
        symbol: row.symbol,
      });
      toast.success(`${row.symbol} signed. ${row.kind === "chain" ? "The network was already one this desk signs." : "You hold the Solana token, not the other chain."}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The trade did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="px-3 py-3">
      <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">Marks</p>
      <h2 className="mt-1 text-lg font-semibold">21 prices. Not 21 chains.</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/55">
        {chains} are networks this desk already signs. {wrapped} are a token on Solana. {prices} are a price and nothing else. Cardano, Aptos, and TON are in that last group.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.symbol} className="rounded-2xl border border-white/10 px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{row.symbol}</p>
              <p className="font-mono text-sm tabular-nums">{row.price != null ? `$${money(row.price)}` : "—"}</p>
            </div>
            <p className="text-[11px] uppercase tracking-wide text-white/40">{row.kind === "chain" ? "Network we sign" : row.kind === "wrapped" ? "Solana token" : "Price only"}{row.change != null ? ` · ${row.change > 0 ? "+" : ""}${row.change.toFixed(1)}%` : ""}</p>
            <p className="mt-1 text-[12px] leading-snug text-white/50">{row.line}</p>
            {row.mint ? (
              <button type="button" disabled={busy === row.symbol} onClick={() => void buy(row)} className="mt-2 h-8 rounded-full bg-white px-3 text-[11px] font-semibold text-black disabled:opacity-40">
                {busy === row.symbol ? "Signing" : "$10 on Solana"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
