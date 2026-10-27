import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ContractsPage as DealWriter } from "@/components/contracts-page";
import { TabLead } from "@/components/tab-lead";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/contracts")({
  loader: () => getHouse(),
  component: ContractsPage,
});

function ContractsPage() {
  const names = Route.useLoaderData();
  return (
    <AppShell>
      <div className="space-y-3 px-3 py-3 lg:px-4">
        <TabLead
          kicker="Contracts"
          title="All contracts"
          accent="one list."
          line="All shows every open option, payment, work order, gift, and invest contract. Open one to sign it."
          live={["An option posts a USDC debit you can close.", "A payment and a gift hold tokens, then send them.", "A work order uses the work account. Invest buys through Jupiter and keeps the share."]}
          coming={["A date that releases a hold without another tap."]}
        />
        <DealWriter />
        <ContractsDesk names={names} />
      </div>
    </AppShell>
  );
}
