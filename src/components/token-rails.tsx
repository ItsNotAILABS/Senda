import { toast } from "sonner";
import { LEGAL, rails } from "@/lib/ecosystem";
import type { HouseListing } from "@/lib/sol-house";

export function TokenRails({ stock }: { stock: HouseListing }) {
  const r = rails(stock.mint, stock.symbol);

  function copy() {
    void navigator.clipboard?.writeText(stock.mint);
    toast.success("Mint copied.");
  }

  return (
    <section className="mt-6">
      <p className="text-xs font-medium tracking-wide text-subtle uppercase">On-chain</p>
      <p className="mt-2 break-all font-mono text-[11px] text-muted">{stock.mint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
          Copy mint
        </button>
        <a href={r.jupiter} target="_blank" rel="noreferrer" className="min-h-11 rounded-full bg-accent px-4 text-xs font-semibold leading-[2.75rem] text-accent-fg">
          Jupiter USDC
        </a>
        <a href={r.raydium} target="_blank" rel="noreferrer" className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold leading-[2.75rem]">
          Raydium
        </a>
        <a href={r.birdeye} target="_blank" rel="noreferrer" className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold leading-[2.75rem]">
          Birdeye
        </a>
        <a href={r.solscan} target="_blank" rel="noreferrer" className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold leading-[2.75rem]">
          Solscan
        </a>
        <a href={r.dexscreener} target="_blank" rel="noreferrer" className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold leading-[2.75rem]">
          Dexscreener
        </a>
        <a href={r.product} target="_blank" rel="noreferrer" className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold leading-[2.75rem]">
          PreStocks
        </a>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-subtle">{LEGAL}</p>
    </section>
  );
}
