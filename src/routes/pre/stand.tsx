import { createFileRoute } from "@tanstack/react-router";
import { PreView } from "@/components/desk-views";
export const Route = createFileRoute("/pre/stand")({
  component: Page,
});

function Page() {
  return <PreView view="stand" />;
}
