import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { UseDesk } from "@/components/use-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/")({
  loader: () => getHouse(),
  component: Home,
  errorComponent: HomeError,
});

function Home() {
  const names = Route.useLoaderData();
  return (
    <AppShell>
      <UseDesk names={names} />
    </AppShell>
  );
}

function HomeError({ error }: { error: Error }) {
  return (
    <AppShell>
      <p className="px-6 py-10 text-sm text-down">{error.message}</p>
    </AppShell>
  );
}
