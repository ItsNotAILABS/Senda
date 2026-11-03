import { createFileRoute } from "@tanstack/react-router";
import { WalletsView } from "@/components/desk-views";
export const Route = createFileRoute("/wallets/power")({
  component: Page,
});

function Page() {
  return <WalletsView view="power" />;
}
