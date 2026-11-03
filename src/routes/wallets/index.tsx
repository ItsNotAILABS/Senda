import { createFileRoute } from "@tanstack/react-router";
import { WalletsView } from "@/components/desk-views";
export const Route = createFileRoute("/wallets/")({
  component: Page,
});

function Page() {
  return <WalletsView view="connect" />;
}
