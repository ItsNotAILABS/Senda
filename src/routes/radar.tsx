import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CoinRadar } from "@/components/coin-radar";
import { NameTicket } from "@/components/name-ticket";
import { RadarDesk } from "@/components/radar-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/radar")({
  validateSearch: (raw: Record<string, unknown>): { mint?: string } => {
    const mint = typeof raw.mint === "string" && raw.mint.length >= 32 ? raw.mint : undefined;
    return mint ? { mint } : {};
  },
  loader: () => getHouse(),
  component: RadarPage,
});

function RadarPage() {
  const house = Route.useLoaderData();
  const { mint } = Route.useSearch();
  const nav = useNavigate();
  function open(next: string) {
    void nav({ to: "/radar", search: { mint: next } });
  }
  return (
    <AppShell>
      {mint ? <NameTicket mint={mint} onClose={() => void nav({ to: "/radar", search: {} })} /> : null}
      <CoinRadar house={house} onOpen={open} />
      <RadarDesk house={house} onOpen={open} />
    </AppShell>
  );
}