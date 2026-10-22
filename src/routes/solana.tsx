import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { SOLANA_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/solana")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Solana" pages={SOLANA_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
