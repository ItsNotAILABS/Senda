import { createFileRoute } from "@tanstack/react-router";
import { MakeView } from "@/components/desk-views";
export const Route = createFileRoute("/make/")({
  component: Page,
});

function Page() {
  return <MakeView view="board" />;
}
