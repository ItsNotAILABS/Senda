import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FilmBand } from "@/components/film-band";
import { TabLead } from "@/components/tab-lead";
import { WalletPicker } from "@/components/wallet-picker";
import { PRESTOCK_MINTS } from "@/lib/phantom";
import { pre8 } from "@/lib/pre8";
import { formatUsd, formatValuation, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function SolanaFloor({ house }: { house: HouseListing[] }) {
  const idx = pre8(house);
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const legs = [...idx.legs].sort((a, b) => b.valuation - a.valuation);
  const mints = liveMints(house);

  function copyMint(symbol: string, mint: string) {
    void navigator.clipboard?.writeText(mint).then(
      () => toast.success(`${symbol} mint copied.`),
      () => toast.error("Could not copy that mint."),
    );
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Solana"
        title="The mints"
        accent="on this book."
        line="Real PreStock mints, row by row. Tap one and it is on your clipboard."
        live={["Copy a live PreStock mint.", idx.n > 0 ? `PRE8 at ${idx.level.toFixed(1)}, from the marks on this book.` : "PRE8 when this book has marks."]}
        coming={["Your own program."]}
      />
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-3xl tracking-tight">Mints</h2>
            <p className="mt-1 text-sm text-muted">Live PreStock mints. Copy puts the address on your clipboard.</p>
          </div>
          <p className="font-mono text-sm tabular-nums text-subtle">{idx.n > 0 ? `PRE8 ${idx.level.toFixed(1)} · ` : ""}{mints.length}</p>
        </div>
        {mints.length === 0 ? (
          <p className="mt-5 text-sm text-subtle">None.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {mints.map((row) => (
              <li key={row.mint} className="flex flex-wrap items-center gap-3 rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
                <span className="w-32 shrink-0 text-base font-semibold">{row.symbol}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-sm">{row.mint}</span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-muted">{row.last == null ? "—" : formatUsd(row.last)}</span>
                <button
                  type="button"
                  onClick={() => copyMint(row.symbol, row.mint)}
                  className="min-h-12 shrink-0 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
                >
                  Copy
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana</p>
          <h1 className="mt-3 text-4xl leading-[1.05] tracking-tight lg:text-6xl">
            PRE8 <span className="font-mono text-accent">{idx.level.toFixed(1)}</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            {idx.n} PreStocks, weighted by mark value. 1000 means the token price matches the mark. They are SPL tokens. You buy them here. Jupiter builds the route. You sign.
          </p>
          <p className="mt-4 font-mono text-sm text-muted">Mark value {formatValuation(idx.tv)}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <p className="text-sm font-semibold">Your signer</p>
          <p className="mt-2 text-sm text-muted">
            {link ? `${link.label} · ${link.address.slice(0, 4)}…${link.address.slice(-4)}` : "No wallet yet. The index is live. A buy waits until you connect."}
          </p>
          <div className="mt-4">{link ? null : <WalletPicker />}</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/pre" className="flex min-h-12 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">Buy a name</Link>
            <Link to="/wallet" className="flex min-h-12 items-center justify-center rounded-full bg-[#9945ff]/20 text-sm font-semibold text-[#d8b4fe]">Convert SOL</Link>
          </div>
        </div>
      </section>
      <FilmBand poster="/images/orbit.jpg" label="SPL. On Solana." />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">The names</h2>
          <ul className="mt-3 space-y-3">
            {legs.map((r) => {
              const ratio = r.mark > 0 ? r.last / r.mark : 1;
              const width = Math.max(8, Math.min(100, ratio * 50));
              return (
                <li key={r.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{r.symbol}</span>
                    <span className="font-mono text-xs text-muted">
                      {formatUsd(r.last)} token · {formatUsd(r.mark)} mark · {formatValuation(r.valuation)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-accent" style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-3">
          <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
            <h2 className="text-lg">What a buy actually does</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>Jupiter builds the route inside Senda.</li>
              <li>Only SOL, USDC, and these mints are allowed.</li>
              <li>The chain simulates it. A failing route never reaches the wallet.</li>
              <li>Impact over 5% is refused. You sign. The key never comes here.</li>
              <li>Minting or redeeming with the issuer is not this page.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function liveMints(house: HouseListing[]) {
  const byMint = new Map<string, { symbol: string; mint: string; last: number | null }>();
  for (const [symbol, mint] of PRESTOCK_MINTS) byMint.set(mint, { symbol, mint, last: null });
  for (const row of house) {
    if (row.venue !== "prestocks" || !row.mint) continue;
    byMint.set(row.mint, { symbol: row.symbol, mint: row.mint, last: row.last });
  }
  return [...byMint.values()];
}
