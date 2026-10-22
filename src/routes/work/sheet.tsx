import { createFileRoute } from "@tanstack/react-router";
import { WorkView } from "@/components/desk-views";
export const Route = createFileRoute("/work/sheet")({
  component: Page,
});

function Page() {
  return <WorkView view="sheet" />;
}
