import { useState } from "react";
import { MarketTicket } from "@/components/market-ticket";
import { formatChg } from "@/lib/sol-house";
import type { ChainTape } from "@/lib/chain-tape";
import type { TapeRow } from "@/lib/chain-tape-map.mjs";
import { evmMarketFor } from "@/lib/trade-book.mjs";

function price(value: number): string {
  if (!(value > 0)) return "—";
  if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(3)}`;
}

export function ChainTapeView({ tape }: { tape: ChainTape }) {
  const [picked, setPicked] = useState<TapeRow | null>(null);
  const solana = tape.rows.filter((row) => row.lane === "solana");
  const chains = tape.rows.filter((row) => row.lane === "chain");
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-3xl tracking-tight">Trade</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Solana markets sign through Jupiter. Ethereum, Arbitrum, Optimism, BNB Chain, and Avalanche sign through LI.FI. A chain with no signer stays a price.
          </p>
        </div>
        <p className="font-mono text-sm text-subtle">
          {tape.jupiter ? "Jupiter" : "Jupiter quiet"} · {tape.defillama ? "DefiLlama" : "DefiLlama quiet"}
        </p>
      </div>
      {tape.rows.length === 0 ? (
        <p className="mt-5 text-sm text-subtle">Prices did not load.</p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <TapeList title="Solana" rows={solana} onPick={setPicked} />
          <TapeList title="Other chains" rows={chains} onPick={setPicked} />
        </div>
      )}
      {picked ? <div className="mt-5"><MarketTicket row={picked} onClose={() => setPicked(null)} /></div> : null}
    </section>
  );
}

function TapeList({ title, rows, onPick }: { title: string; rows: ChainTape["rows"]; onPick: (row: TapeRow) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => {
          const canSign = row.symbol !== "USDC" && (row.lane === "solana" || evmMarketFor(row.symbol));
          return (
            <li key={row.id} className="flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-3">
              <span className="w-20 shrink-0 font-semibold">{row.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{row.name}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums">{price(row.usd)}</span>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-subtle">{formatChg(row.change24h)}</span>
              {canSign ? (
                <button type="button" onClick={() => onPick(row)} className="shrink-0 text-sm font-semibold text-accent">Trade</button>
              ) : (
                <span className="w-14 shrink-0 text-right text-xs text-subtle">{row.venue}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
