import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PredictDesk } from "@/components/predict-desk";
import { loadPerpBoard, loadPredEvents } from "@/lib/jup-venues";

export const Route = createFileRoute("/social")({
  loader: async () => {
    const [sports, coins, perps] = await Promise.all([
      loadPredEvents({ data: { category: "sports" } }).catch(() => []),
      loadPredEvents({ data: { category: "crypto" } }).catch(() => []),
      loadPerpBoard().catch(() => []),
    ]);
    return { sports, coins, perps };
  },
  component: SocialPage,
});

function SocialPage() {
  const data = Route.useLoaderData();
  return (
    <AppShell>
      <PredictDesk initialEvents={data.sports} initialCoins={data.coins} initialPerps={data.perps} />
    </AppShell>
  );
}