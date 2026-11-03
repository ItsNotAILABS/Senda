import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { SEND_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/payments")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Send" pages={SEND_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
