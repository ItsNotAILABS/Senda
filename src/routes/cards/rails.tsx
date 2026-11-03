import { createFileRoute } from "@tanstack/react-router";
import { ShopView } from "@/components/desk-views";
export const Route = createFileRoute("/cards/rails")({
  component: Page,
});

function Page() {
  return <ShopView view="rails" />;
}
