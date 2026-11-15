import { createFileRoute } from "@tanstack/react-router";
import { WorkDesk } from "@/components/work-desk";
import { getHouse, HOUSE_FALLBACK } from "@/lib/sol-house";

export const Route = createFileRoute("/work/")({
  loader: () => getHouse().catch(() => HOUSE_FALLBACK),
  component: Page,
});

function Page() {
  const names = Route.useLoaderData();
  return <WorkDesk names={names} />;
}
