import { createFileRoute } from "@tanstack/react-router";
import { CoverView } from "@/components/desk-views";
export const Route = createFileRoute("/cover/")({
  component: Page,
});

function Page() {
  return <CoverView view="drop" />;
}
