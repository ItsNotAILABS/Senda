import { useEffect, useState } from "react";
import { listTrades, onTrades, type TradeFill } from "@/lib/trade-log";
import { PairHoldings } from "@/components/pair-bundle";
import { cn } from "@/lib/utils";

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function signedUsd(n: number): string {
  const body = usd(Math.abs(n));
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return body;
}

function solQty(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortSig(signature: string): string {
  return signature.length <= 12 ? signature : `${signature.slice(0, 8)}…`;
}

type SymbolBook = {
  symbol: string;
  buys: number;
  sells: number;
  sends: number;
  net: number;
};

function booksOf(fills: TradeFill[]): SymbolBook[] {
  const map = new Map<string, SymbolBook>();
  for (const fill of fills) {
    const row = map.get(fill.symbol) ?? { symbol: fill.symbol, buys: 0, sells: 0, sends: 0, net: 0 };
    if (fill.side === "buy") row.buys += fill.usd;
    else if (fill.side === "sell") row.sells += fill.usd;
    else row.sends += fill.usd;
    row.net = row.sells - row.buys - row.sends;
    map.set(fill.symbol, row);
  }
  return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function sideSum(fills: TradeFill[], side: TradeFill["side"]): number {
  return fills.reduce((sum, fill) => sum + (fill.side === side ? fill.usd : 0), 0);
}

export function PortfolioAnalytics({
  owner,
  usdc,
  sol,
  heldUsd,
  dayMove,
}: {
  owner: string;
  usdc: number;
  sol: number;
  heldUsd: number;
  dayMove: number;
}) {
  const [fills, setFills] = useState<TradeFill[]>([]);

  useEffect(() => {
    const pull = () => setFills(listTrades());
    pull();
    return onTrades(pull);
  }, []);

  const buys = sideSum(fills, "buy");
  const sells = sideSum(fills, "sell");
  const sends = sideSum(fills, "send");
  const net = sells - buys - sends;
  const books = booksOf(fills);
  const newest = [...fills].sort((a, b) => b.at - a.at).slice(0, 8);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Signed book</h2>
        <p className="font-mono text-[11px] text-subtle tabular-nums">{fills.length} fills</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">Cash</p>
          {owner ? (
            <>
              <p className="mt-1 font-mono text-xl tabular-nums">${usdc.toFixed(2)}</p>
              <p className="text-xs text-muted">USDC</p>
              <p className="mt-2 font-mono text-sm tabular-nums text-white/80">{solQty(sol)} SOL</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Connect Phantom.</p>
          )}
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">Holdings</p>
          <p className="mt-1 font-mono text-xl tabular-nums">{usd(heldUsd)}</p>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">Day move</p>
          <p className={cn("mt-1 font-mono text-xl tabular-nums", dayMove >= 0 ? "text-up" : "text-down")}>
            {signedUsd(dayMove)}
          </p>
        </div>
      </div>

      <PairHoldings owner={owner} />

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <dt className="text-[11px] tracking-[0.14em] text-subtle uppercase">Fills</dt>
          <dd className="mt-1 font-mono text-lg tabular-nums">{fills.length}</dd>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <dt className="text-[11px] tracking-[0.14em] text-subtle uppercase">Buys</dt>
          <dd className="mt-1 font-mono text-lg tabular-nums">{usd(buys)}</dd>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <dt className="text-[11px] tracking-[0.14em] text-subtle uppercase">Sells</dt>
          <dd className="mt-1 font-mono text-lg tabular-nums">{usd(sells)}</dd>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <dt className="text-[11px] tracking-[0.14em] text-subtle uppercase">Sends</dt>
          <dd className="mt-1 font-mono text-lg tabular-nums">{usd(sends)}</dd>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <dt className="text-[11px] tracking-[0.14em] text-subtle uppercase">Net</dt>
          <dd className={cn("mt-1 font-mono text-lg tabular-nums", net >= 0 ? "text-up" : "text-down")}>{signedUsd(net)}</dd>
        </div>
      </dl>

      {fills.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No signed swap has been recorded in this browser.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="text-[11px] tracking-[0.14em] text-subtle uppercase">
                  <th className="pb-2 font-normal">Symbol</th>
                  <th className="pb-2 text-right font-normal">Buys</th>
                  <th className="pb-2 text-right font-normal">Sells</th>
                  <th className="pb-2 text-right font-normal">Sends</th>
                  <th className="pb-2 text-right font-normal">Net</th>
                </tr>
              </thead>
              <tbody>
                {books.map((row) => (
                  <tr key={row.symbol} className="border-t border-white/[0.06]">
                    <td className="py-2 text-sm font-semibold">{row.symbol}</td>
                    <td className="py-2 text-right font-mono text-sm tabular-nums">{usd(row.buys)}</td>
                    <td className="py-2 text-right font-mono text-sm tabular-nums">{usd(row.sells)}</td>
                    <td className="py-2 text-right font-mono text-sm tabular-nums">{usd(row.sends)}</td>
                    <td className={cn("py-2 text-right font-mono text-sm tabular-nums", row.net >= 0 ? "text-up" : "text-down")}>
                      {signedUsd(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="text-[11px] tracking-[0.14em] text-subtle uppercase">
                  <th className="pb-2 font-normal">Time</th>
                  <th className="pb-2 font-normal">Side</th>
                  <th className="pb-2 font-normal">Symbol</th>
                  <th className="pb-2 text-right font-normal">USD</th>
                  <th className="pb-2 text-right font-normal">Signature</th>
                </tr>
              </thead>
              <tbody>
                {newest.map((fill) => (
                  <tr key={fill.signature} className="border-t border-white/[0.06]">
                    <td className="py-2 font-mono text-[11px] text-muted">{when(fill.at)}</td>
                    <td className={cn("py-2 text-sm font-semibold", fill.side === "buy" ? "text-up" : fill.side === "sell" ? "text-down" : "text-muted")}>
                      {fill.side}
                    </td>
                    <td className="py-2 text-sm">{fill.symbol}</td>
                    <td className="py-2 text-right font-mono text-sm tabular-nums">{usd(fill.usd)}</td>
                    <td className="py-2 text-right">
                      <a
                        href={`https://solscan.io/tx/${fill.signature}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-accent"
                      >
                        {shortSig(fill.signature)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
