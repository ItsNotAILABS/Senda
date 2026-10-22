import { createFileRoute } from "@tanstack/react-router";
import { PositionsPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/positions")({
  component: Page,
});

function Page() {
  return <PositionsPage />;
}
