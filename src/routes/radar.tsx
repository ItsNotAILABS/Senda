import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RadarDesk } from "@/components/radar-desk";
import { TokenTape } from "@/components/token-tape";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/radar")({
  loader: () => getHouse(),
  component: RadarPage,
});

function RadarPage() {
  const house = Route.useLoaderData();
  return (
    <AppShell>
      <div className="px-4 pt-4">
        <h1 className="text-4xl font-semibold tracking-tight">Spot</h1>
        <p className="mt-2 text-sm text-white/55">Every coin, in its own card. Open it to trade the whole ticket.</p>
      </div>
      <TokenTape />
      <RadarDesk house={house} />
    </AppShell>
  );
}
