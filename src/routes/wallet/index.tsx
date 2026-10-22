import { createFileRoute } from "@tanstack/react-router";
import { ConvertView } from "@/components/desk-views";
export const Route = createFileRoute("/wallet/")({
  component: Page,
});

function Page() {
  return <ConvertView view="swap" />;
}
