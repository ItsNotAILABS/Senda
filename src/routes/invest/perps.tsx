import { createFileRoute } from "@tanstack/react-router";
import { PerpsPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/perps")({
  component: Page,
});

function Page() {
  return <PerpsPage />;
}
