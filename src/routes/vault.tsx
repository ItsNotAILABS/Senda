import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { VaultDesk } from "@/components/vault-desk";

export const Route = createFileRoute("/vault")({
  component: VaultPage,
});

function VaultPage() {
  return (
    <AppShell>
      <VaultDesk />
    </AppShell>
  );
}
