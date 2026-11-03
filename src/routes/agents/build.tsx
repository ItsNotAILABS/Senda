import { createFileRoute } from "@tanstack/react-router";
import { AgentsView } from "@/components/desk-views";
export const Route = createFileRoute("/agents/build")({
  component: Page,
});

function Page() {
  return <AgentsView pane="build" />;
}
