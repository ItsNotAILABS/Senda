import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { BackpackWallet } from "@/components/backpack-wallet";

export const Route = createFileRoute("/backpack")({
  component: BackpackPage,
});

function BackpackPage() {
  return (
    <AppShell>
      <BackpackWallet />
    </AppShell>
  );
}
