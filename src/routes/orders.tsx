import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { OrdersDesk } from "@/components/orders-desk";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  return (
    <AppShell>
      <OrdersDesk />
    </AppShell>
  );
}
