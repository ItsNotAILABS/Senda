import { createFileRoute } from "@tanstack/react-router";
import { BasketPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/basket")({
  component: Page,
});

function Page() {
  return <BasketPage />;
}
