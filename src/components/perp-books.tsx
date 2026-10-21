import { useState } from "react";
import { HlTicket } from "@/components/hl-ticket";
import { MonadPerps } from "@/components/monad-perps";
import { SolPerps } from "@/components/sol-perps";
import { cn } from "@/lib/utils";

export function PerpBooks() {
  const [venue, setVenue] = useState<"solana" | "monad" | "world">("solana");
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto">
        <button type="button" onClick={() => setVenue("solana")} className={cn("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold", venue === "solana" ? "bg-white text-black" : "bg-[#2a2a2e]")}>Solana</button>
        <button type="button" onClick={() => setVenue("monad")} className={cn("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold", venue === "monad" ? "bg-white text-black" : "bg-[#2a2a2e]")}>Monad</button>
        <button type="button" onClick={() => setVenue("world")} className={cn("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold", venue === "world" ? "bg-white text-black" : "bg-[#2a2a2e]")}>Other countries</button>
      </div>
      {venue === "solana" ? <SolPerps /> : null}
      {venue === "monad" ? <MonadPerps /> : null}
      {venue === "world" ? (
        <>
          <p className="text-xs text-white/45">Hyperliquid, for Mexico and the other countries that venue allows. A US or UK address is refused.</p>
          <HlTicket />
        </>
      ) : null}
    </div>
  );
}
