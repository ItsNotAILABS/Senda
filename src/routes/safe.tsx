import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { VaultTab } from "@/components/vault-tab";

export const Route = createFileRoute("/safe")({
  component: SafePage,
});

function SafePage() {
  return (
    <AppShell>
      <VaultTab />
    </AppShell>
  );
}
