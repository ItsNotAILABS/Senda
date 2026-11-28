import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WireDesk } from "@/components/wire-desk";
import { loadCoins } from "@/lib/coin-tape";
import { getHouse } from "@/lib/sol-house";
import { loadHeadlines } from "@/lib/wire";

export const Route = createFileRoute("/wire")({
  loader: async () => {
    const [house, coins, news] = await Promise.all([
      getHouse().catch(() => []),
      loadCoins().catch(() => []),
      loadHeadlines().catch(() => []),
    ]);
    return { house, coins, news };
  },
  component: WirePage,
});

function WirePage() {
  const data = Route.useLoaderData();
  return (
    <AppShell>
      <WireDesk house={data.house} coins={data.coins} news={data.news} />
    </AppShell>
  );
}
