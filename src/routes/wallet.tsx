import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WalletDesk } from "@/components/wallet-desk";

type MoneySearch = { buy?: string; lane?: "swap" | "wallets" | "chains" | "pesos" | "stake" };

const LANES = new Set(["swap", "wallets", "chains", "pesos", "stake"]);

export const Route = createFileRoute("/wallet")({
  validateSearch: (raw: Record<string, unknown>): MoneySearch => {
    const buy = typeof raw.buy === "string" ? raw.buy : undefined;
    const lane = typeof raw.lane === "string" && LANES.has(raw.lane) ? (raw.lane as MoneySearch["lane"]) : undefined;
    return { ...(buy ? { buy } : {}), ...(lane ? { lane } : {}) };
  },
  component: WalletPage,
});

function WalletPage() {
  const { buy, lane } = Route.useSearch();
  return (
    <AppShell>
      <WalletDesk buy={buy} lane={lane} />
    </AppShell>
  );
}
