import { createFileRoute } from "@tanstack/react-router";
import { SendView } from "@/components/desk-views";
export const Route = createFileRoute("/payments/add")({
  component: Page,
});

function Page() {
  return <SendView page="add" />;
}
