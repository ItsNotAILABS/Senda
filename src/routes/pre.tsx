import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PreDesk } from "@/components/pre-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/pre")({
  loader: () => getHouse(),
  component: PrePage,
  errorComponent: PreError,
});

function PrePage() {
  const house = Route.useLoaderData();
  return (
    <AppShell>
      <PreDesk names={house} />
    </AppShell>
  );
}

function PreError({ error }: { error: Error }) {
  return (
    <AppShell>
      <p className="px-6 py-10 text-sm text-down">{error.message}</p>
    </AppShell>
  );
}
