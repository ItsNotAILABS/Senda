import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { MAKE_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/make")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Make" pages={MAKE_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
