import { createFileRoute } from "@tanstack/react-router";
import { CoverView } from "@/components/desk-views";
export const Route = createFileRoute("/cover/life")({
  component: Page,
});

function Page() {
  return <CoverView view="life" />;
}
