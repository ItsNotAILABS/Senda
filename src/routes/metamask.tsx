import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MetaMaskLane } from "@/components/wallet-lanes";
import { WalletsDesk } from "@/components/wallets-desk";

export const Route = createFileRoute("/metamask")({
  component: MetaMaskPage,
});

function MetaMaskPage() {
  return (
    <AppShell>
      <MetaMaskLane />
      <WalletsDesk />
    </AppShell>
  );
}
