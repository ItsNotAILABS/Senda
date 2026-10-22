import { createFileRoute } from "@tanstack/react-router";
import { DocsView } from "@/components/desk-views";
export const Route = createFileRoute("/docs/cards")({
  component: Page,
});

function Page() {
  return <DocsView book="cards" />;
}
