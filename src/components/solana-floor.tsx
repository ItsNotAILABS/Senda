import { Link } from "@tanstack/react-router";
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
      <header className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">PRE8 {idx.level.toFixed(1)}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              {idx.n} PreStocks, weighted by mark value. 1000 means the token price matches the mark. These are SPL tokens. You buy them in this app.
            </p>
          </div>
          <p className="font-mono text-sm text-muted">Mark value {formatValuation(idx.tv)}</p>
        </div>
      </header>

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
            <h2 className="text-lg">Your signer</h2>
            <p className="mt-1 text-sm text-muted">
              {link ? `${link.label} · ${link.address.slice(0, 4)}…${link.address.slice(-4)}` : "No wallet yet. Connect the one that already holds SOL or USDC."}
            </p>
            <div className="mt-3">{link ? null : <WalletPicker />}</div>
            <div className="mt-3 flex flex-col gap-2">
              <Link to="/pre" className="flex min-h-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
                Buy a PreStock
              </Link>
              <Link to="/wallet" className="flex min-h-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                Convert SOL
              </Link>
            </div>
          </section>
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
