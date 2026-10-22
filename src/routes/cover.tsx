import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { COVER_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/cover")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Cover" pages={COVER_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
