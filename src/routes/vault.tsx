import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { PORTFOLIO_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/vault")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Portfolio" pages={PORTFOLIO_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
