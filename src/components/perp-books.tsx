import { useState } from "react";
import { HlTicket } from "@/components/hl-ticket";
import { MonadPerps } from "@/components/monad-perps";
import { OstiumBook } from "@/components/ostium-book";
import { SolPerps } from "@/components/sol-perps";
import { cn } from "@/lib/utils";

export function PerpBooks() {
  const [venue, setVenue] = useState<"solana" | "ostium" | "monad" | "world">("ostium");
  const tabs = [
    ["ostium", "Ostium"],
    ["solana", "Drift"],
    ["world", "Hyperliquid"],
    ["monad", "Monad"],
  ] as const;
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setVenue(id)} className={cn("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold", venue === id ? "bg-white text-black" : "bg-[#2a2a2e]")}>
            {label}
          </button>
        ))}
      </div>
      {venue === "ostium" ? <OstiumBook /> : null}
      {venue === "solana" ? <SolPerps /> : null}
      {venue === "monad" ? <MonadPerps /> : null}
      {venue === "world" ? (
        <>
          <p className="text-xs text-white/45">Hyperliquid. A US or UK address is refused by that venue.</p>
          <HlTicket />
        </>
      ) : null}
    </div>
  );
}