import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RevolutLane } from "@/components/wallet-lanes";
import { WalletsDesk } from "@/components/wallets-desk";

export const Route = createFileRoute("/revolut")({
  component: RevolutPage,
});

function RevolutPage() {
  return (
    <AppShell>
      <RevolutLane />
      <WalletsDesk />
    </AppShell>
  );
}
