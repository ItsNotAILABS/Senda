import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
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

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[28px] border border-white/10 bg-[#0c0c14] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana</p>
          <h1 className="mt-3 text-5xl tracking-tight lg:text-6xl">
            PRE8 <span className="text-accent">{idx.level.toFixed(1)}</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            {idx.n} PreStocks, weighted by mark value. 1000 means the token price matches the mark. They are SPL tokens. You buy them here. Jupiter builds the route. You sign.
          </p>
          <p className="mt-4 font-mono text-sm text-muted">Mark value {formatValuation(idx.tv)}</p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
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
        <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
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
          <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
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

      <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
        <h2 className="text-lg">Mints</h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {PRESTOCK_MINTS.map(([symbol, mint]) => (
            <li key={mint} className="rounded-2xl bg-black/40 px-3 py-2">
              <p className="text-sm font-semibold">{symbol}</p>
              <p className="break-all font-mono text-[11px] text-subtle">{mint}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
