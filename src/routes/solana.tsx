import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MarketsDesk } from "@/components/markets-desk";
import { SolanaFloor } from "@/components/solana-floor";
import { getChainTape, type ChainTape } from "@/lib/chain-tape";
import { getHouse, type HouseListing } from "@/lib/sol-house";

export const Route = createFileRoute("/solana")({
  loader: () => getHouse(),
  component: MarketsPage,
});

const EMPTY_TAPE: ChainTape = { ok: false, rows: [], note: "", jupiter: false, defillama: false };

function MarketsPage() {
  const house = Route.useLoaderData();
  return (
    <AppShell>
      <MarketsDesk house={house} coins={[]} />
      <SolanaBlock house={house.filter((row) => row.venue === "prestocks")} />
    </AppShell>
  );
}

function SolanaBlock({ house }: { house: HouseListing[] }) {
  const [tape, setTape] = useState<ChainTape>(EMPTY_TAPE);
  useEffect(() => {
    let live = true;
    getChainTape()
      .then((next) => live && setTape(next))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return <SolanaFloor house={house} tape={tape} />;
}