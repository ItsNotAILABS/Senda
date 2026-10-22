import { createFileRoute } from "@tanstack/react-router";
import { MakeView } from "@/components/desk-views";
export const Route = createFileRoute("/make/post")({
  component: Page,
});

function Page() {
  return <MakeView view="post" />;
}
