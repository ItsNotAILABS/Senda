import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { HomeDesk } from "@/components/home-desk";
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
      <HomeDesk names={names} />
    </AppShell>
  );
}

function HomeError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "The book did not load.";
  return (
    <AppShell>
      <p className="px-6 py-10 text-sm text-down">{message}</p>
    </AppShell>
  );
}
