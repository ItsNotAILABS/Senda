import { createFileRoute } from "@tanstack/react-router";
import { OptionsPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/options")({
  component: Page,
});

function Page() {
  return <OptionsPage />;
}
