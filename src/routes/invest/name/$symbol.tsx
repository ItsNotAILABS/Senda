import { createFileRoute } from "@tanstack/react-router";
import { TicketPage } from "@/components/trade-pages";

export const Route = createFileRoute("/invest/name/$symbol")({
  component: Page,
});

function Page() {
  const { symbol } = Route.useParams();
  return <TicketPage symbol={symbol} />;
}
