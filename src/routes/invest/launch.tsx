import { createFileRoute } from "@tanstack/react-router";
import { LaunchPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/launch")({
  component: Page,
});

function Page() {
  return <LaunchPage />;
}
