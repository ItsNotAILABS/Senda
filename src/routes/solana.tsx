import { createFileRoute } from "@tanstack/react-router";
import { AccountsDesk } from "@/components/accounts-desk";
import { AppShell } from "@/components/app-shell";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { LaunchDesk } from "@/components/launch-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/solana")({
  loader: () => getHouse(),
  component: SolanaPage,
});

function SolanaPage() {
  const house = Route.useLoaderData().filter((h) => h.venue === "prestocks");
  return (
    <AppShell>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto xl:grid-cols-[minmax(0,1fr)_420px]">
        <EcosystemDesk house={house} />
        <div className="border-t border-border xl:border-t-0 xl:border-l">
          <LaunchDesk />
          <AccountsDesk />
        </div>
      </div>
    </AppShell>
  );
}
