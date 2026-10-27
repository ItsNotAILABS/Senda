import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signStockSwap } from "@/lib/jup-sign";
import { invalidateChain, readChain, splHolding, type ChainToken } from "@/lib/phantom";
import { rememberTrade, onTrades } from "@/lib/trade-log";
import type { HouseListing } from "@/lib/sol-house";

const CASH = new Set(["USDC", "CASH", "USDT"]);

type Row = ChainToken & { price: number };

function qty(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function PositionsBook({ owner, names }: { owner: string; names?: HouseListing[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [sol, setSol] = useState(0);
  const [size, setSize] = useState("1");
  const [openMint, setOpenMint] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!owner) {
      setRows([]);
      setSol(0);
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((snap) => {
          if (!live) return;
          const px = new Map((names || []).map((n) => [n.mint, n.last]));
          setSol(snap.sol);
          const next = snap.tokens
            .filter((t) => t.ui > 0 && !CASH.has(t.symbol))
            .map((t) => ({ ...t, price: px.get(t.mint) || 0 }))
            .sort((a, b) => b.ui * (b.price || 0) - a.ui * (a.price || 0) || a.symbol.localeCompare(b.symbol));
          setRows(next);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 8000);
    const stop = onTrades(pull);
    return () => {
      live = false;
      window.clearInterval(id);
      stop();
    };
  }, [owner, names]);

  async function trade(row: Row, side: "buy" | "sell" | "close") {
    const n = Number(size);
    if (side !== "close" && !(n > 0)) {
      toast.error("Enter a size.");
      return;
    }
    setBusy(`${row.mint}:${side}`);
    try {
      const held = side === "buy" ? null : await splHolding(owner, row.mint);
      let tokenAmount: bigint | undefined;
      let usd = n;
      if (side !== "buy") {
        const raw = BigInt(held?.raw || "0");
        if (raw <= 0n) throw new Error("This account holds none of that.");
        if (side === "close" || !(row.price > 0)) {
          tokenAmount = raw;
          usd = Math.max(row.ui * row.price, 0.01);
        } else {
          const want = BigInt(Math.max(1, Math.floor((n / row.price) * 10 ** (held?.decimals || row.decimals || 9))));
          tokenAmount = want >= raw ? raw : want;
          usd = Math.max(n, 0.01);
        }
      }
      const done = await signStockSwap({
        owner,
        mint: row.mint,
        side: side === "buy" ? "buy" : "sell",
        usd,
        decimals: held?.decimals || row.decimals || 9,
        tokenAmount,
      });
      rememberTrade({
        symbol: row.symbol,
        side: side === "buy" ? "buy" : "sell",
        usd,
        mint: row.mint,
        signature: done.signature,
      });
      invalidateChain(owner);
      const again = await readChain(owner);
      const px = new Map((names || []).map((name) => [name.mint, name.last]));
      setRows(
        again.tokens
          .filter((t) => t.ui > 0 && !CASH.has(t.symbol))
          .map((t) => ({ ...t, price: px.get(t.mint) || 0 })),
      );
      const left = again.tokens.find((t) => t.mint === row.mint)?.ui ?? 0;
      toast.success(
        side === "buy"
          ? `Added to ${row.symbol}. You hold ${qty(left)}.`
          : left > 0
            ? `Reduced ${row.symbol}. You hold ${qty(left)}.`
            : `Closed ${row.symbol}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The position did not change.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section>
      <div className="flex items-end justify-between px-1">
        <p className="text-sm font-semibold">Positions</p>
        <p className="font-mono text-[11px] text-subtle">{sol.toFixed(4)} SOL</p>
      </div>
      {!owner ? <p className="mt-3 px-1 text-sm text-muted">Connect Phantom.</p> : null}
      {owner && rows.length === 0 ? <p className="mt-3 px-1 text-sm text-muted">No position yet. A buy shows up here.</p> : null}
      <ul className="mt-1">
        {rows.map((row) => {
          const value = row.ui * row.price;
          const locked = busy.startsWith(row.mint);
          const open = openMint === row.mint;
          return (
            <li key={row.mint} className="border-b border-white/[0.06]">
              <button type="button" onClick={() => setOpenMint(open ? "" : row.mint)} className="flex min-h-14 w-full items-center justify-between gap-3 px-1 text-left">
                <span>
                  <span className="block text-sm font-semibold">{row.symbol}</span>
                  <span className="block font-mono text-[11px] text-subtle">{qty(row.ui)}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-sm tabular-nums">{value > 0 ? money(value) : "Live"}</span>
                </span>
              </button>
              {open ? (
                <div className="grid grid-cols-3 gap-2 px-1 pb-3">
                  <button type="button" disabled={locked} onClick={() => void trade(row, "buy")} className="min-h-11 rounded-xl bg-accent text-sm font-semibold text-accent-fg">Buy</button>
                  <button type="button" disabled={locked} onClick={() => void trade(row, "sell")} className="min-h-11 rounded-xl border border-white/15 text-sm font-semibold">Sell</button>
                  <button type="button" disabled={locked} onClick={() => void trade(row, "close")} className="min-h-11 rounded-xl bg-[#e11d48] text-sm font-semibold text-white">Close</button>
                  <label className="col-span-3 flex items-center gap-2 text-xs text-subtle">
                    Size $
                    <input
                      value={size}
                      onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      className="h-10 w-24 rounded-lg border border-white/10 bg-black/40 px-2 font-mono text-fg"
                    />
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
