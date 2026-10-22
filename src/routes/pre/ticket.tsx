import { createFileRoute } from "@tanstack/react-router";
import { PreView } from "@/components/desk-views";
export const Route = createFileRoute("/pre/ticket")({
  component: Page,
});

function Page() {
  return <PreView view="ticket" />;
}
