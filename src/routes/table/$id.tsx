import { createFileRoute, Link } from "@tanstack/react-router";
import { HouseTable } from "@/components/house-table";
import { PitShell } from "@/components/pit-shell";
import { Button } from "@/components/ui/button";
import { isHouse, listingFromLive } from "@/lib/feeds";
import { getBook, getPit } from "@/lib/pit";
import { usePit } from "@/lib/use-pit";

export const Route = createFileRoute("/table/$id")({
  loader: async ({ params }) => {
    const pit = await getPit();
    const found = pit.markets.find((m) => m.id === params.id) ?? null;
    const book = found ?? (await getBook({ data: { id: params.id } }));
    return { pit, book };
  },
  component: TableSeat,
});

function TableSeat() {
  const { id } = Route.useParams();
  const seed = Route.useLoaderData();
  const pit = usePit(seed.pit);
  const market = pit.markets.find((m) => m.id === id) ?? seed.book ?? null;
  const house = market && isHouse(market.venue) ? listingFromLive(market) : null;

  if (house) {
    return (
      <PitShell chips={pit.chips} frozen={pit.frozen}>
        <HouseTable
          stock={house}
          rows={[]}
          chips={pit.chips}
          frozen={pit.frozen}
          onBuyIn={pit.buyIn}
          onTrade={(side, spend) => pit.trade(id, side, spend)}
        />
      </PitShell>
    );
  }

  return (
    <PitShell chips={pit.chips} frozen={pit.frozen}>
      <main className="grid flex-1 place-items-center px-6 text-center">
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-semibold">Not a house name</h1>
          <p className="text-sm text-muted">This desk is Tessera and PreStocks only.</p>
          <Button asChild>
            <Link to="/">Back to names</Link>
          </Button>
        </div>
      </main>
    </PitShell>
  );
}
