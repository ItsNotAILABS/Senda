import { createFileRoute } from "@tanstack/react-router";
import { PreView } from "@/components/desk-views";
export const Route = createFileRoute("/pre/cover")({
  component: Page,
});

function Page() {
  return <PreView view="cover" />;
}
