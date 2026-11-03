import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { WALLET_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/wallets")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Wallets" pages={WALLET_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
