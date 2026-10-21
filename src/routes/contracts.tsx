import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ContractsDesk } from "@/components/contracts-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/contracts")({
  loader: () => getHouse(),
  component: ContractsPage,
  errorComponent: ContractsError,
});

function ContractsPage() {
  const names = Route.useLoaderData();
  return (
    <AppShell>
      <ContractsDesk names={names} />
    </AppShell>
  );
}

function ContractsError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "The contracts did not load.";
  return (
    <AppShell>
      <p className="px-6 py-10 text-sm text-down">{message}</p>
    </AppShell>
  );
}
