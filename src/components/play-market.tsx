import { JupBoard } from "@/components/jup-ticket";
import type { HouseListing } from "@/lib/sol-house";

export function PlayMarket({
  house,
}: {
  house: HouseListing[];
  cash: number;
  onDebit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  onCredit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const names = house.filter((h) => h.venue === "prestocks" && h.last > 0 && h.mark > 0 && !/xai/i.test(h.symbol));
  return (
    <div className="pb-8">
      <header className="px-4 pt-5">
        <p className="text-sm text-muted">Play · routed instruments</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Same print. You fill it.</h1>
        <p className="mt-2 text-sm text-muted">
          These are just easier ways to touch PreStocks. Buy and sell size on Jupiter. Senda doesn’t warehouse the other
          side. Last vs mark is the SPV print — 24/7, already live.
        </p>
      </header>
      <JupBoard names={names} />
    </div>
  );
}
