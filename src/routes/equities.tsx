import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EquitiesDesk } from "@/components/equities-desk";
import { getEquityBook } from "@/lib/equities";

export const Route = createFileRoute("/equities")({
  loader: () => getEquityBook(),
  component: EquitiesPage,
  errorComponent: EquitiesError,
});

function EquitiesPage() {
  const book = Route.useLoaderData();
  return (
    <AppShell>
      <EquitiesDesk book={book} />
    </AppShell>
  );
}

function EquitiesError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "The book did not load.";
  return (
    <AppShell>
      <p className="px-6 py-10 text-sm text-down">{message}</p>
    </AppShell>
  );
}
