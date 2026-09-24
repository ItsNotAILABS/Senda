import { toast } from "sonner";
import { PACKS } from "@/lib/basket";
import { applyHouseDrop, loadHouseBook, saveHouseBook } from "@/lib/house-paper";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { formatMoney } from "@/lib/wallet";
import { useState } from "react";

export function BasketDesk({
  house,
  cash,
  onDebit,
}: {
  house: HouseListing[];
  cash: number;
  onDebit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [raw, setRaw] = useState("");
  const spend = Number(raw) || 0;
  const pre = house.filter((h) => h.venue === "prestocks");

  async function buy(packId: string) {
    const pack = PACKS.find((p) => p.id === packId);
    if (!pack || !(spend > 0)) {
      toast.error("Enter dollars.");
      return;
    }
    const legs = pack.symbols
      .map((s) => pre.find((h) => h.symbol.toUpperCase() === s || h.symbol.replace(/[-_]/g, "").toUpperCase().includes(s)))
      .filter((x): x is HouseListing => Boolean(x));
    if (legs.length < 2) {
      toast.error("Not enough names live for this pack.");
      return;
    }
    if (cash < spend) {
      toast.error("Not enough cash.");
      return;
    }
    const each = spend / legs.length;
    const d = await onDebit(spend, pack.name);
    if (!d.ok) {
      toast.error(d.error);
      return;
    }
    let book = loadHouseBook();
    for (const leg of legs) book = applyHouseDrop(book, leg.id, "yes", each, leg.last);
    saveHouseBook(book);
    toast.success(`Bought ${pack.name} · ${formatMoney(spend)}`);
  }

  return (
    <div className="px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        PRE8 is valuation-weighted across live PreStocks. Other packs are equal-weight SPL baskets. One ticket, several
        mints, same cash. Live size: Jupiter USDC pairs.
      </p>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Dollars"
        className="mt-4 min-h-12 w-full rounded-2xl bg-elevated px-4 font-mono text-lg outline-none"
      />
      <ul className="mt-4 space-y-2">
        {PACKS.map((p) => {
          const legs = p.symbols
            .map((s) => pre.find((h) => h.symbol.toUpperCase().includes(s) || h.name.toUpperCase().includes(s)))
            .filter(Boolean);
          return (
            <li key={p.id} className="rounded-2xl bg-elevated px-4 py-4">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="mt-1 text-xs text-muted">
                {legs.map((l) => `${l!.symbol} ${formatUsd(l!.last)}`).join(" · ") || p.symbols.join(" · ")}
              </p>
              <button
                type="button"
                onClick={() => void buy(p.id)}
                className="mt-3 min-h-11 w-full rounded-full bg-fg text-sm font-semibold text-bg"
              >
                Buy pack
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
