import { Link } from "@tanstack/react-router";
import { LEGAL } from "@/lib/ecosystem";
import { pre8 } from "@/lib/pre8";
import { formatUsd, formatValuation, type HouseListing } from "@/lib/sol-house";

export function EcosystemDesk({ house }: { house: HouseListing[] }) {
  const idx = pre8(house);
  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="font-display text-3xl tracking-tight">PreStocks rails</h2>
      <p className="mt-2 text-sm text-muted">
        SPL tokens on Solana mainnet. 1:1 SPV-backed economic exposure. Spot on Jupiter. Liquidity on Meteora DLMM and
        Raydium. Mint/redeem is KYC with the issuer; DEX is not.
      </p>
      <section className="mt-5 rounded-2xl bg-paper p-4 text-ink">
        <p className="text-[11px] font-semibold tracking-wide uppercase text-ink/50">PRE8 · valuation-weighted</p>
        <p className="mt-1 font-display text-4xl tabular-nums">{idx.level.toFixed(1)}</p>
        <p className="mt-1 text-sm text-ink/60">
          {idx.n} names · mark AUM {formatValuation(idx.tv)} · 1000 = last in line with mark
        </p>
      </section>
      <ul className="mt-4 divide-y divide-border">
        {idx.legs
          .slice()
          .sort((a, b) => b.valuation - a.valuation)
          .map((r) => (
            <li key={r.id} className="flex items-baseline justify-between py-3">
              <div>
                <p className="text-sm font-semibold">{r.symbol}</p>
                <p className="font-mono text-[11px] text-subtle">
                  last {formatUsd(r.last)} · mark {formatUsd(r.mark)}
                </p>
              </div>
              <p className="font-mono text-xs text-muted">{formatValuation(r.valuation)}</p>
            </li>
          ))}
      </ul>
      <h3 className="mt-8 text-xs font-medium tracking-wide text-subtle uppercase">Do it here</h3>
      <ul className="mt-2 overflow-hidden rounded-2xl bg-elevated">
        {(
          [
            ["/pre", "Buy", "Every PreStock. USDC from the wallet you connected."],
            ["/wallet", "Hold and convert", "SOL, USDC, or a name you hold. The swap stays on this page."],
            ["/agents", "Agents", "A job on your wallet. You still approve the send."],
            ["/invest", "Games", "The stake is a buy of the name, not a link out."],
          ] as const
        ).map(([to, name, blurb]) => (
          <li key={to} className="border-b border-border last:border-0">
            <Link to={to} className="block px-4 py-3">
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted">{blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-subtle">{LEGAL}</p>
    </div>
  );
}
