import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MarketIntelligence } from "@/components/market-intelligence";
import { useHouse } from "@/lib/use-house";
import { jupTape, type TapeRow } from "@/lib/world-book";

export const Route = createFileRoute("/market-intelligence")({
  component: MarketIntelligencePage,
});

function MarketIntelligencePage() {
  const house = useHouse();
  const [tape, setTape] = useState<TapeRow[]>([]);
  useEffect(() => {
    let active = true;
    async function pull() {
      try {
        const rows = await jupTape();
        if (active) setTape(rows);
      } catch {
        if (active) setTape([]); // fail closed; never synthesize liquidity
      }
    }
    void pull();
    const interval = window.setInterval(() => void pull(), 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  return <MarketIntelligence house={house} tape={tape} />;
}
