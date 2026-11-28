import { createFileRoute } from "@tanstack/react-router";
import { SendView } from "@/components/desk-views";

export const Route = createFileRoute("/payments/shop")({
  component: Page,
});

function Page() {
  return <SendView page="shop" />;
}
