import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EquitiesDesk } from "@/components/equities-desk";
import { getEquityBook } from "@/lib/equities";

export const Route = createFileRoute("/xstocks")({
  loader: () => getEquityBook(),
  component: XStocksPage,
});

function XStocksPage() {
  const book = Route.useLoaderData();
  return (
    <AppShell>
      <EquitiesDesk book={book} />
    </AppShell>
  );
}
