import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WalletDesk } from "@/components/wallet-desk";

export const Route = createFileRoute("/swap")({
  component: SwapPage,
});

function SwapPage() {
  return (
    <AppShell>
      <WalletDesk />
    </AppShell>
  );
}
