import { useEffect, useState } from "react";
import { loadCoins, type LiveCoin } from "@/lib/coin-tape";
import { cn } from "@/lib/utils";

const URL = "https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=100";

let cache: LiveCoin[] = [];
const listeners = new Set<(rows: LiveCoin[]) => void>();
let timer = 0;

async function pullCoins() {
  try {
    const res = await fetch(URL, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("The coin tape did not come back.");
    const body = (await res.json()) as Array<{
      id?: string;
      symbol?: string;
      name?: string;
      icon?: string;
      usdPrice?: number;
      decimals?: number;
      stats24h?: { priceChange?: number };
    }>;
    const rows: LiveCoin[] = [];
    for (const row of body) {
      const price = Number(row.usdPrice) || 0;
      if (!row.id || !row.symbol || !(price > 0)) continue;
      rows.push({
        id: row.id,
        symbol: row.symbol,
        name: row.name || row.symbol,
        price,
        change: Number(row.stats24h?.priceChange) || 0,
        icon: row.icon || "",
        decimals: Number.isFinite(Number(row.decimals)) ? Number(row.decimals) : 6,
      });
    }
    if (!rows.length) throw new Error("Empty tape.");
    cache = rows;
    listeners.forEach((fn) => fn(rows));
  } catch {
    const rows = await loadCoins().catch(() => [] as LiveCoin[]);
    if (!rows.length) return;
    cache = rows;
    listeners.forEach((fn) => fn(rows));
  }
}

function listen(fn: (rows: LiveCoin[]) => void) {
  listeners.add(fn);
  if (!timer) {
    void pullCoins().catch(() => undefined);
    timer = window.setInterval(() => void pullCoins().catch(() => undefined), 15_000);
  }
  return () => {
    listeners.delete(fn);
  };
}

export function coinPx(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}

export function useCoins(): LiveCoin[] {
  const [rows, setRows] = useState<LiveCoin[]>(cache);
  useEffect(() => listen(setRows), []);
  return rows;
}

export function CoinTicker() {
  const rows = useCoins();
  const loop = rows.length ? [...rows, ...rows] : [];
  return (
    <div className="flex h-10 items-center gap-3 overflow-hidden border-y border-white/10 bg-black px-3">
      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] text-accent-fg uppercase">Live</span>
      <div className="min-w-0 flex-1 overflow-hidden">
        {loop.length === 0 ? (
          <p className="font-mono text-[11px] text-subtle">Pulling every coin…</p>
        ) : (
          <div className="coin-tape flex w-max gap-5 whitespace-nowrap">
            {loop.map((c, i) => (
              <span key={`${c.id}-${i}`} className="inline-flex items-baseline gap-1.5 font-mono text-[11px]">
                <span className="text-fg">{c.symbol}</span>
                <span className="tabular-nums text-white/80">{coinPx(c.price)}</span>
                <span className={cn("tabular-nums", c.change < 0 ? "text-down" : "text-up")}>
                  {c.change >= 0 ? "+" : ""}
                  {c.change.toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
