import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WalletDesk } from "@/components/wallet-desk";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
});

function WalletPage() {
  return (
    <AppShell>
      <WalletDesk />
    </AppShell>
  );
}
