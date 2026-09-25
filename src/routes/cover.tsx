import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CoverDesk } from "@/components/cover-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/cover")({
  loader: () => getHouse(),
  component: CoverPage,
});

function CoverPage() {
  const names = Route.useLoaderData();
  return (
    <AppShell>
      <CoverDesk names={names} />
    </AppShell>
  );
}