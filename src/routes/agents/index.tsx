import { createFileRoute } from "@tanstack/react-router";
import { AgentsView } from "@/components/desk-views";
export const Route = createFileRoute("/agents/")({
  component: Page,
});

function Page() {
  return <AgentsView pane="studio" />;
}
