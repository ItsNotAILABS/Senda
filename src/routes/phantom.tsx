import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PhantomLane } from "@/components/wallet-lanes";
import { VaultDesk } from "@/components/vault-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/phantom")({
  loader: () => getHouse(),
  component: PhantomPage,
});

function PhantomPage() {
  const house = Route.useLoaderData();
  return (
    <AppShell>
      <PhantomLane />
      <VaultDesk names={house.filter((h) => h.venue === "prestocks")} />
    </AppShell>
  );
}
