import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RobinhoodLane } from "@/components/wallet-lanes";
import { WalletsDesk } from "@/components/wallets-desk";

export const Route = createFileRoute("/robinhood")({
  component: RobinhoodPage,
});

function RobinhoodPage() {
  return (
    <AppShell>
      <RobinhoodLane />
      <WalletsDesk />
    </AppShell>
  );
}
