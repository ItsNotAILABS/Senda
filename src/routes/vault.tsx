import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { VaultDesk } from "@/components/vault-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/vault")({
  loader: () => getHouse(),
  component: VaultPage,
});

function VaultPage() {
  const names = Route.useLoaderData();
  return (
    <AppShell>
      <VaultDesk names={names} />
    </AppShell>
  );
}
