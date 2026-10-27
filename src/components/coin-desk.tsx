import { useState } from "react";
import { toast } from "sonner";
import { coinPx, useCoins } from "@/components/coin-ticker";
import { PrintChart } from "@/components/print-chart";
import { SolBook } from "@/components/sol-book";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import type { LiveCoin } from "@/lib/coin-tape";
import { connectPhantom, phantomProvider } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const SIZES = [1, 5, 25] as const;

/** Today's movers, then every verified Solana market, paged. Buy and sell sign on this Phantom. */
export function CoinDesk() {
  const wallet = useWallet();
  const rows = useCoins();
  const [pick, setPick] = useState("");
  const [usd, setUsd] = useState<(typeof SIZES)[number]>(5);
  const [busy, setBusy] = useState("");
  const sol = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const coin = rows.find((row) => row.id === pick) ?? rows[0] ?? null;

  async function owner() {
    const live = phantomProvider()?.publicKey?.toString();
    const who = live || sol || (await connectPhantom());
    if (who !== sol) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return who;
  }

  async function trade(row: LiveCoin, side: "buy" | "sell") {
    setBusy(side);
    try {
      const who = await owner();
      const amountRaw = side === "buy" ? Math.round(usd * 1_000_000) : Math.max(1, Math.round((usd / row.price) * 10 ** row.decimals));
      const done = await signRoute({
        owner: who,
        inputMint: side === "buy" ? USDC : row.id,
        outputMint: side === "buy" ? row.id : USDC,
        amountRaw,
        outDecimals: side === "buy" ? row.decimals : 6,
        inDecimals: side === "buy" ? 6 : row.decimals,
        usd,
        symbol: row.symbol,
        refPrice: row.price,
      });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${row.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Coins</p>
        <h2 className="mt-1 font-display text-2xl tracking-tight">{coin ? coin.symbol : "The tape"}</h2>
        <p className="mt-1 text-sm text-muted">
          {rows.length ? `${rows.length} coins Jupiter traded today.` : "Waiting on Jupiter."} The full book is under the tape, one page at a time. Buy and sell are USDC. You sign.
        </p>
      </div>
      {coin ? <PrintChart mint={coin.id} symbol={coin.symbol} /> : null}
      {coin ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-3xl tabular-nums">{coinPx(coin.price)}</p>
            <p className={cn("font-mono text-sm tabular-nums", coin.change < 0 ? "text-down" : "text-up")}>
              {coin.change >= 0 ? "+" : ""}
              {coin.change.toFixed(1)}%
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {SIZES.map((n) => (
              <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 rounded-full px-3 text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/10 text-muted")}>
                ${n}
              </button>
            ))}
            <button type="button" disabled={busy !== ""} onClick={() => void trade(coin, "buy")} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
              {busy === "buy" ? "…" : `Buy $${usd}`}
            </button>
            <button type="button" disabled={busy !== ""} onClick={() => void trade(coin, "sell")} className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40">
              {busy === "sell" ? "…" : `Sell $${usd}`}
            </button>
          </div>
        </div>
      ) : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" onClick={() => setPick(row.id)} className={cn("flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left", coin?.id === row.id ? "border-white bg-white text-black" : "border-white/10")}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{row.symbol}</span>
                <span className={cn("font-mono text-[11px] tabular-nums", coin?.id === row.id ? "opacity-70" : row.change < 0 ? "text-down" : "text-up")}>
                  {row.change >= 0 ? "+" : ""}
                  {row.change.toFixed(1)}%
                </span>
              </span>
              <span className="font-mono text-sm tabular-nums">{coinPx(row.price)}</span>
            </button>
          </li>
        ))}
      </ul>
      <SolBook />
    </div>
  );
}
