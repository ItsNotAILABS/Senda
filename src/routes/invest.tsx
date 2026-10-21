import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PitFloor } from "@/components/pit-floor";
import { getPit } from "@/lib/pit";
import { usePit } from "@/lib/use-pit";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const DESKS = new Set([
  "spot", "world", "comms", "options", "perps", "pre", "bridge", "vault", "tape", "prog", "book",
  "basket", "lend", "minty", "curve", "wrap", "eco", "xstock", "futures", "loans", "hedge", "cover", "pred", "index", "shares", "products",
]);

export const Route = createFileRoute("/invest")({
  validateSearch: (search: Record<string, unknown>): { desk?: string } => ({
    desk: typeof search.desk === "string" && DESKS.has(search.desk) ? search.desk : undefined,
  }),
  loader: () => getPit(),
  component: Invest,
});

function Invest() {
  const seed = Route.useLoaderData();
  const pit = usePit(seed);
  const wallet = useWallet();
  const cash = Math.floor((wallet.w.balances.USD || 0) + (wallet.w.balances.USDC || 0));

  const { desk } = Route.useSearch();
  return (
    <AppShell>
      <PitFloor
        desk={desk}
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