import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CardsDesk } from "@/components/cards-desk";

export const Route = createFileRoute("/cards")({
  validateSearch: (raw: Record<string, unknown>): { spend?: number } => {
    const n = Number(raw.spend);
    if (Number.isFinite(n) && n > 0) return { spend: Math.round(n) };
    return {};
  },
  component: CardsPage,
});

function CardsPage() {
  const { spend } = Route.useSearch();
  return (
    <AppShell>
      <CardsDesk initialSpend={spend ?? 0} />
    </AppShell>
  );
}
