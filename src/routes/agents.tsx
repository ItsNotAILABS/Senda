import { createFileRoute } from "@tanstack/react-router";
import { AgentsDesk } from "@/components/agents-desk";
import { AppShell } from "@/components/app-shell";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/agents")({
  loader: () => getHouse(),
  component: AgentsPage,
  errorComponent: AgentsError,
});

function AgentsPage() {
  const house = Route.useLoaderData();
  return (
    <AppShell>
      <AgentsDesk names={house} />
    </AppShell>
  );
}

function AgentsError({ error }: { error: Error }) {
  return (
    <AppShell>
      <p className="px-6 py-10 text-sm text-down">{error.message}</p>
    </AppShell>
  );
}
