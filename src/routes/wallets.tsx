import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WalletsDesk } from "@/components/wallets-desk";

export const Route = createFileRoute("/wallets")({
  component: WalletsPage,
});

function WalletsPage() {
  return (
    <AppShell>
      <WalletsDesk />
    </AppShell>
  );
}
