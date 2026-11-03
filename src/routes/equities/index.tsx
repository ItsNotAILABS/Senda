import { createFileRoute } from "@tanstack/react-router";
import { ListedView } from "@/components/desk-views";
export const Route = createFileRoute("/equities/")({
  component: Page,
});

function Page() {
  return <ListedView view="market" />;
}
