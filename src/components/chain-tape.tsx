import { formatChg } from "@/lib/sol-house";
import type { ChainTape } from "@/lib/chain-tape";

function price(value: number): string {
  if (!(value > 0)) return "—";
  if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(3)}`;
}

export function ChainTapeView({ tape }: { tape: ChainTape }) {
  const solana = tape.rows.filter((row) => row.lane === "solana");
  const chains = tape.rows.filter((row) => row.lane === "chain");
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-3xl tracking-tight">Other markets</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{tape.note}</p>
        </div>
        <p className="font-mono text-sm text-subtle">
          {tape.jupiter ? "Jupiter" : "Jupiter quiet"} · {tape.defillama ? "DefiLlama" : "DefiLlama quiet"}
        </p>
      </div>
      {tape.rows.length === 0 ? (
        <p className="mt-5 text-sm text-subtle">Prices did not load.</p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <TapeList title="Solana" rows={solana} />
          <TapeList title="Other chains" rows={chains} />
        </div>
      )}
    </section>
  );
}

function TapeList({ title, rows }: { title: string; rows: ChainTape["rows"] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-3">
            <span className="w-20 shrink-0 font-semibold">{row.symbol}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted">{row.name}</span>
            <span className="shrink-0 font-mono text-sm tabular-nums">{price(row.usd)}</span>
            <span className="w-16 shrink-0 text-right font-mono text-xs text-subtle">{formatChg(row.change24h)}</span>
            {row.href ? (
              <a href={row.href} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-accent">
                Jupiter
              </a>
            ) : (
              <span className="w-14 shrink-0 text-right text-xs text-subtle">{row.venue}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
