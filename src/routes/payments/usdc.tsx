import { createFileRoute } from "@tanstack/react-router";
import { SendView } from "@/components/desk-views";
export const Route = createFileRoute("/payments/usdc")({
  component: Page,
});

function Page() {
  return <SendView page="chain" />;
}
