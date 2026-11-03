import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MarketStream } from "@/components/market-stream";
import { getHouse } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export const Route = createFileRoute("/market")({
  loader: () => getHouse(),
  component: MarketPage,
});

function MarketPage() {
  const house = Route.useLoaderData();
  const wallet = useWallet();
  const cash = Math.floor((wallet.w.balances.USD || 0) + (wallet.w.balances.USDC || 0));
  const pre = house.filter((h) => h.venue === "prestocks");

  return (
    <AppShell>
      <MarketStream
        house={pre}
        cash={cash}
        onDebit={async (amount, ref) => wallet.investOut(amount, ref)}
        onCredit={async (amount, ref) => wallet.investIn(amount, ref)}
      />
    </AppShell>
  );
}
