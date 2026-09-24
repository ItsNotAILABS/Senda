import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WalletDesk } from "@/components/wallet-desk";

type MoneySearch = { buy?: string };

export const Route = createFileRoute("/wallet")({
  validateSearch: (raw: Record<string, unknown>): MoneySearch => {
    const buy = typeof raw.buy === "string" ? raw.buy : undefined;
    return buy ? { buy } : {};
  },
  component: WalletPage,
});

function WalletPage() {
  const { buy } = Route.useSearch();
  return (
    <AppShell>
      <WalletDesk buy={buy} />
    </AppShell>
  );
}
