import { createFileRoute } from "@tanstack/react-router";
import { RoutesPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/routes")({
  component: Page,
});

function Page() {
  return <RoutesPage />;
}
