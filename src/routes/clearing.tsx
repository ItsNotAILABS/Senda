import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ClearingDesk } from "@/components/clearing-desk";
import { getClearing } from "@/lib/clearing-status";

export const Route = createFileRoute("/clearing")({
  loader: () => getClearing(),
  component: ClearingPage,
});

function ClearingPage() {
  const book = Route.useLoaderData();
  return (
    <AppShell>
      <ClearingDesk book={book} />
    </AppShell>
  );
}
