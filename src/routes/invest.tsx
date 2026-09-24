import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PitFloor } from "@/components/pit-floor";
import { getPit } from "@/lib/pit";
import { usePit } from "@/lib/use-pit";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export const Route = createFileRoute("/invest")({
  loader: () => getPit(),
  component: Invest,
});

function Invest() {
  const seed = Route.useLoaderData();
  const pit = usePit(seed);
  const wallet = useWallet();
  const cash = Math.floor((wallet.w.balances.USD || 0) + (wallet.w.balances.USDC || 0));

  return (
    <AppShell>
      <PitFloor
        chips={cash}
        frozen={pit.frozen}
        onBuyIn={async () => ({ ok: false, error: "Add money first." })}
        onTrade={async (marketId, _side, spend) => {
          const r = wallet.investOut(spend, marketId);
          if (!r.ok) return { ok: false, error: r.error };
          return { ok: true, cost: spend, shares: spend };
        }}
        onCredit={async (amount, ref) => wallet.investIn(amount, ref)}
        onDebit={async (amount, ref) => wallet.investOut(amount, ref)}
      />
    </AppShell>
  );
}
