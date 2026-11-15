import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EquitiesDesk } from "@/components/equities-desk";
import { TabLead } from "@/components/tab-lead";
import { getEquityBook } from "@/lib/equities";

export const Route = createFileRoute("/xstocks")({
  loader: () => getEquityBook(),
  component: XStocksPage,
});

function XStocksPage() {
  const book = Route.useLoaderData();
  return (
    <AppShell>
      <div className="px-3 pt-3 lg:px-4">
        <TabLead
          kicker="xStocks"
          title="Stocks and ETFs."
          accent=""
          line="Names Jupiter traded in the last day come first. Halted names sit at the bottom. Phantom buys the token."
          live={["ETFs", "Single stocks", "Jupiter buy"]}
          coming={["Parking the shares inside a named contract."]}
        />
      </div>
      <EquitiesDesk book={book} />
    </AppShell>
  );
}
