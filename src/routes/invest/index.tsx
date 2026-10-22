import { createFileRoute } from "@tanstack/react-router";
import { TradePit } from "@/components/trade-pit";

export const Route = createFileRoute("/invest/")({
  component: Page,
});

function Page() {
  return <TradePit />;
}
