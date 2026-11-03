import { createFileRoute } from "@tanstack/react-router";
import { ProtectPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/protect")({
  component: Page,
});

function Page() {
  return <ProtectPage />;
}
