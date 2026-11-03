import { createFileRoute } from "@tanstack/react-router";
import { RailsPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/rails")({
  component: Page,
});

function Page() {
  return <RailsPage />;
}
