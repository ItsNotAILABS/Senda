import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadRayPools, type RayPool } from "@/lib/ray-pools";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

/** Deep Raydium pools. Holding the token is a Jupiter buy into the wallet. */
export function RayBoard() {
  const [rows, setRows] = useState<RayPool[]>([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    loadRayPools().then(setRows).catch(() => setRows([]));
  }, []);

  async function buy(row: RayPool) {
    setBusy(row.mint);
    try {
      const owner = await connectPhantom();
      await signRoute({
        owner,
        inputMint: USDC,
        outputMint: row.mint,
        amountRaw: 5_000_000,
        outDecimals: row.decimals,
        inDecimals: 6,
        usd: 5,
        symbol: row.symbol,
      });
      toast.success(`${row.symbol} is in the wallet. The pool behind it is Raydium, ${money(row.tvl)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The buy did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="px-3 py-3">
      <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">Raydium</p>
      <h2 className="mt-1 text-lg font-semibold">The deep pools. A buy lands in your wallet.</h2>
      <p className="mt-1 text-sm text-white/50">Sorted by pool size. The route is Jupiter. The depth number is Raydium’s. $5 of USDC.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.mint} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.symbol}</p>
              <p className="truncate text-[11px] text-white/45">{row.name} · pool {money(row.tvl)} · 24h {money(row.volume)}</p>
            </div>
            <button type="button" disabled={busy === row.mint} onClick={() => void buy(row)} className="h-9 shrink-0 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
              {busy === row.mint ? "Signing" : "Buy $5"}
            </button>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-3 text-sm text-white/40">Raydium did not return a pool.</p> : null}
    </section>
  );
}
