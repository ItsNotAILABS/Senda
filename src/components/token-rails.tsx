import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
import { LEGAL } from "@/lib/ecosystem";
import type { HouseListing } from "@/lib/sol-house";

export function TokenRails({ stock }: { stock: HouseListing }) {
  function copy() {
    void navigator.clipboard?.writeText(stock.mint);
    toast.success("Mint copied.");
  }

  return (
    <section className="mt-6">
      <p className="text-xs font-medium tracking-wide text-subtle uppercase">In this app</p>
      <p className="mt-2 break-all font-mono text-[11px] text-muted">{stock.mint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FillButton
          mint={stock.mint}
          usd={10}
          price={stock.last}
          label={`Buy $10 ${stock.symbol}`}
          className="min-h-11 rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg"
        />
        <Link
          to="/wallet"
          search={{ buy: stock.symbol }}
          className="inline-flex min-h-11 items-center rounded-full bg-elevated px-4 text-xs font-semibold"
        >
          Pay with SOL
        </Link>
        <button type="button" onClick={copy} className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
          Copy mint
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-subtle">{LEGAL}</p>
    </section>
  );
}
