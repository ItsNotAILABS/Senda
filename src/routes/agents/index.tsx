import { createFileRoute } from "@tanstack/react-router";
import { AgentFloor } from "@/components/agent-floor";
import { getHouse, HOUSE_FALLBACK } from "@/lib/sol-house";

export const Route = createFileRoute("/agents/")({
  loader: () => getHouse().catch(() => HOUSE_FALLBACK),
  component: Page,
});

function Page() {
  const names = Route.useLoaderData();
  return <AgentFloor names={names} />;
}
