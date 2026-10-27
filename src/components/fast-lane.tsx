import { useEffect, useState } from "react";
import { PrintChart } from "@/components/print-chart";
import { quoteRoute, SOL } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { loadPulse, type TapeRow } from "@/lib/universe";
import { cn } from "@/lib/utils";

const CLOCK = "senda.quote.clock";

type Side = { buyMs: number; sellMs: number };

function pct(change: number): number {
  if (!Number.isFinite(change)) return 0;
  return change;
}

function readClock(): Side | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CLOCK) || "null") as Side | null;
    if (!raw || !(raw.buyMs > 0) || !(raw.sellMs > 0)) return null;
    return raw;
  } catch {
    return null;
  }
}

async function timePair(): Promise<Side> {
  const t0 = performance.now();
  const buy = await quoteRoute({ inputMint: USDC, outputMint: SOL, amountRaw: 5_000_000, outDecimals: 9 });
  const buyMs = Math.max(1, Math.round(performance.now() - t0));
  const atoms = Math.max(1, Math.round(buy.outUi * 1e9));
  const t1 = performance.now();
  await quoteRoute({ inputMint: SOL, outputMint: USDC, amountRaw: atoms, outDecimals: 6 });
  const sellMs = Math.max(1, Math.round(performance.now() - t1));
  return { buyMs, sellMs };
}

function ms(n: number | null) {
  return n == null ? "—" : `${n.toLocaleString("en-US")}ms`;
}

/** Live Jupiter quote times and the names that actually moved. Not a copied scoreboard. */
export function FastLane({ chartMint, chartSymbol }: { chartMint?: string; chartSymbol?: string }) {
  const [before, setBefore] = useState<Side | null>(null);
  const [now, setNow] = useState<Side | null>(null);
  const [fault, setFault] = useState("");
  const [rows, setRows] = useState<TapeRow[]>([]);
  const [board, setBoard] = useState("Pulling the book…");

  useEffect(() => {
    let live = true;
    const prior = readClock();
    setBefore(prior);
    timePair()
      .then((first) => {
        if (!live) return;
        if (prior) {
          setNow(first);
          sessionStorage.setItem(CLOCK, JSON.stringify(first));
          return;
        }
        setBefore(first);
        return timePair().then((second) => {
          if (!live) return;
          setNow(second);
          sessionStorage.setItem(CLOCK, JSON.stringify(second));
        });
      })
      .catch((e: unknown) => {
        if (live) setFault(e instanceof Error ? e.message : "Jupiter did not time a quote.");
      });
    const pull = (attempt: number) => {
      loadPulse()
        .then((pulse) => {
          if (!live) return;
          const next = [...pulse.rows].sort((a, b) => pct(b.change) - pct(a.change)).slice(0, 8);
          if (!next.length) throw new Error("No priced names.");
          setRows(next);
          setBoard("");
        })
        .catch((e: unknown) => {
          if (!live) return;
          if (attempt < 2) {
            window.setTimeout(() => pull(attempt + 1), 700);
            return;
          }
          setBoard(e instanceof Error ? e.message : "The book did not load.");
        });
    };
    pull(0);
    return () => {
      live = false;
    };
  }, []);

  const max = Math.max(1, ...rows.map((r) => Math.abs(pct(r.change))));

  return (
    <div className="space-y-3">
      <section className="rounded-[28px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Solana quote</p>
            <h2 className="mt-1 text-xl font-semibold">$5 USDC ↔ SOL</h2>
          </div>
          <p className="text-right text-[11px] text-muted">Measured on this phone. Not a landing time.</p>
        </div>
        <div className="mt-4 grid grid-cols-[4.5rem_1fr_1fr] gap-y-2 text-sm">
          <span />
          <span className="text-center text-[11px] tracking-[0.14em] text-subtle uppercase">Before</span>
          <span className="text-center text-[11px] tracking-[0.14em] text-subtle uppercase">Now</span>
          <span className="font-semibold">Buy</span>
          <span className="text-center font-mono tabular-nums text-muted">{ms(before?.buyMs ?? null)}</span>
          <span className={cn("text-center font-mono tabular-nums", now && before && now.buyMs <= before.buyMs ? "text-accent" : "text-fg")}>{ms(now?.buyMs ?? null)}</span>
          <span className="font-semibold">Sell</span>
          <span className="text-center font-mono tabular-nums text-muted">{ms(before?.sellMs ?? null)}</span>
          <span className={cn("text-center font-mono tabular-nums", now && before && now.sellMs <= before.sellMs ? "text-accent" : "text-fg")}>{ms(now?.sellMs ?? null)}</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          After you sign, a Solana swap lands on the next slot. A crosschain order is a different clock: the other chain settles it. Senda does not hold either side.
        </p>
        {fault ? <p className="mt-2 text-xs text-down">{fault}</p> : null}
      </section>
      {rows.length > 0 ? (
        <section className="rounded-[28px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Moving</p>
          <h2 className="mt-1 text-xl font-semibold">24h on the book</h2>
          <ul className="mt-3 space-y-2">
            {rows.map((r) => {
              const n = pct(r.change);
              const width = Math.max(6, (Math.abs(n) / max) * 100);
              return (
                <li key={r.mint} className="grid grid-cols-[4.5rem_1fr_4.2rem] items-center gap-2">
                  <span className="text-sm font-semibold">{r.symbol}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/10">
                    <span className={cn("block h-full rounded-full", n < 0 ? "bg-[#ff5d73]" : "bg-accent")} style={{ width: `${width}%` }} />
                  </span>
                  <span className={cn("text-right font-mono text-xs tabular-nums", n < 0 ? "text-[#ff5d73]" : "text-accent")}>
                    {n >= 0 ? "+" : ""}
                    {n.toFixed(1)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : board ? (
        <p className="px-1 text-xs text-muted">{board}</p>
      ) : null}
      <PrintChart mint={chartMint || SOL} symbol={chartSymbol || "SOL"} className="h-[360px]" />
    </div>
  );
}
