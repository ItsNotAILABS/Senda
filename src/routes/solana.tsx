import { createFileRoute } from "@tanstack/react-router";
import { AccountsDesk } from "@/components/accounts-desk";
import { AppShell } from "@/components/app-shell";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { LaunchDesk } from "@/components/launch-desk";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/solana")({
  loader: () => getHouse(),
  component: SolanaPage,
});

function SolanaPage() {
  const house = Route.useLoaderData().filter((h) => h.venue === "prestocks");
  return (
    <AppShell>
      <div className="space-y-3 px-3 py-3 lg:px-4">
        <header className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana</p>
          <h1 className="mt-2 text-4xl">The rail under the names</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            PreStocks are SPL tokens. You buy them here. Jupiter builds the route. You sign. Mint and redeem with the issuer is a different door, and this page does not pretend to be it.
          </p>
        </header>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-[28px] border border-white/10 bg-[#101018]">
            <EcosystemDesk house={house} />
          </section>
          <div className="space-y-3">
            <section className="rounded-[28px] border border-white/10 bg-[#101018] p-2">
              <LaunchDesk />
            </section>
            <section className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
              <AccountsDesk />
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
