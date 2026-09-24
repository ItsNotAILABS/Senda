import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EquitiesDesk } from "@/components/equities-desk";
import { getEquityBook } from "@/lib/equities";

export const Route = createFileRoute("/")({
  loader: () => getEquityBook(),
  component: Home,
  errorComponent: HomeError,
});

function Home() {
  const book = Route.useLoaderData();
  return (
    <AppShell>
      <EquitiesDesk book={book} />
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
