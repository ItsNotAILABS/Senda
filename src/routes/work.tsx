import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WorkDesk } from "@/components/work-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/work")({
  loader: () => getHouse(),
  component: WorkPage,
});

function WorkPage() {
  const names = Route.useLoaderData();
  return (
    <AppShell>
      <WorkDesk names={names} />
    </AppShell>
  );
}
