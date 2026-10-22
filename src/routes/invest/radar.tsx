import { createFileRoute } from "@tanstack/react-router";
import { RadarPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/radar")({
  component: Page,
});

function Page() {
  return <RadarPage />;
}
