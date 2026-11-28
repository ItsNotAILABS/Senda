import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { PreDesk } from "@/components/pre-desk";
import { getPreRoutes } from "@/lib/prestock";
import { getHouse, HOUSE_FALLBACK } from "@/lib/sol-house";

const parent = getRouteApi("/pre");

export const Route = createFileRoute("/pre/")({
  loader: async () => {
    const [house, routes] = await Promise.all([
      getHouse().catch(() => HOUSE_FALLBACK),
      getPreRoutes().catch(() => []),
    ]);
    return { house, routes };
  },
  component: Page,
});

function Page() {
  const { house, routes } = Route.useLoaderData();
  const { q } = parent.useSearch();
  return <PreDesk names={house} routes={routes} query={q ?? ""} />;
}
