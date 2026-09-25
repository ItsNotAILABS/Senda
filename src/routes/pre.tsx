import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PreDesk } from "@/components/pre-desk";
import { getPreRoutes } from "@/lib/prestock";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/pre")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search.q === "string" ? search.q : "";
    return q ? { q } : {};
  },
  loader: async () => {
    const [house, routes] = await Promise.all([getHouse(), getPreRoutes()]);
    return { house, routes };
  },
  component: PrePage,
  errorComponent: PreError,
});

function PrePage() {
  const { house, routes } = Route.useLoaderData();
  const { q } = Route.useSearch();
  return (
    <AppShell>
      <PreDesk names={house} routes={routes} query={q ?? ""} />
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
