import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PreDesk } from "@/components/pre-desk";
import { getClosedPrints } from "@/lib/closed-prints";
import { getPreRoutes } from "@/lib/prestock";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/pre")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search.q === "string" ? search.q : "";
    return q ? { q } : {};
  },
  loader: async () => {
    const [house, routes, closed] = await Promise.all([getHouse(), getPreRoutes(), getClosedPrints()]);
    return { house, routes, closed };
  },
  component: PrePage,
  errorComponent: PreError,
});

function PrePage() {
  const { house, routes, closed } = Route.useLoaderData();
  const { q } = Route.useSearch();
  return (
    <AppShell>
      <PreDesk names={house} routes={routes} query={q ?? ""} closed={closed} />
    </AppShell>
  );
}

function PreError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "The book did not load.";
  return (
    <AppShell>
      <p className="px-6 py-10 text-sm text-down">{message}</p>
    </AppShell>
  );
}
