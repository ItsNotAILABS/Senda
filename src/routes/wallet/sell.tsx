import { createFileRoute } from "@tanstack/react-router";
import { ConvertView } from "@/components/desk-views";
export const Route = createFileRoute("/wallet/sell")({
  component: Page,
});

function Page() {
  return <ConvertView view="sell" />;
}
