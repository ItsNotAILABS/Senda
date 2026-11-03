import { createFileRoute } from "@tanstack/react-router";
import { PortfolioView } from "@/components/desk-views";
export const Route = createFileRoute("/vault/")({
  component: Page,
});

function Page() {
  return <PortfolioView view="all" />;
}
