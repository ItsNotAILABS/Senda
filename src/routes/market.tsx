import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CryptoTv } from "@/components/crypto-tv";

export const Route = createFileRoute("/market")({
  component: MarketPage,
});

function MarketPage() {
  return (
    <AppShell>
      <CryptoTv />
    </AppShell>
  );
}
