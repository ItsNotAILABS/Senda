import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { HouseTable } from "@/components/house-table";
import { Button } from "@/components/ui/button";
import { getPit } from "@/lib/pit";
import { getHouse, getHouseOne } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export const Route = createFileRoute("/house/$id")({
  loader: async ({ params }) => {
    const [rows, pit] = await Promise.all([getHouse(), getPit()]);
    const found = rows.find((r) => r.id === params.id) ?? (await getHouseOne({ data: { id: params.id } }));
    return { stock: found, pit, rows };
  },
  component: HouseSeat,
});

function HouseSeat() {
  const seed = Route.useLoaderData();
  const wallet = useWallet();
  const stock = seed.stock;
  const cash = Math.floor((wallet.w.balances.USD || 0) + (wallet.w.balances.USDC || 0));

  if (!stock) {
    return (
      <AppShell>
        <main className="grid flex-1 place-items-center px-6 text-center">
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Name not found</h1>
            <p className="text-sm text-muted">That token is not on the book.</p>
            <Button asChild>
              <Link to="/invest">Back to PreStocks</Link>
            </Button>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <HouseTable
        stock={stock}
        rows={seed.rows}
        chips={cash}
        frozen={false}
        onBuyIn={async () => ({ ok: false, error: "Add money first." })}
        onTrade={async (side, spend) => {
          const r = wallet.investOut(spend, `${stock.symbol} ${side}`);
          if (!r.ok) return { ok: false, error: r.error };
          return { ok: true, cost: spend, shares: spend };
        }}
        onDebit={async (amount, ref) => wallet.investOut(amount, ref)}
        onCredit={async (amount, ref) => wallet.investIn(amount, ref)}
      />
    </AppShell>
  );
}
