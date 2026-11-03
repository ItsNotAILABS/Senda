import { createFileRoute } from "@tanstack/react-router";
import { CurvePage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/curve")({
  component: Page,
});

function Page() {
  return <CurvePage />;
}
