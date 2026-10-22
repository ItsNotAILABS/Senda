import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MarketsPage } from "@/components/markets-page";
import { InstrumentPage } from "@/components/registry-desk";

export const Route = createFileRoute("/wire")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => {
    const id = typeof search.id === "string" ? search.id.slice(0, 80) : "";
    return id ? { id } : {};
  },
  component: Page,
});

function Page() {
  const { id } = Route.useSearch();
  return <AppShell>{id ? <InstrumentPage id={id} /> : <MarketsPage />}</AppShell>;
}
