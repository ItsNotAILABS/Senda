import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { SHOP_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/cards")({
  validateSearch: (raw: Record<string, unknown>): { spend?: number } => {
    const n = Number(raw.spend);
    return Number.isFinite(n) && n > 0 ? { spend: Math.round(n) } : {};
  },
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Shop" pages={SHOP_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
