import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ListedView } from "@/components/desk-views";
import { TabLead } from "@/components/tab-lead";

export const Route = createFileRoute("/xstocks")({
  component: Page,
});

function Page() {
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
      <ListedView view="market" />
    </AppShell>
  );
}
