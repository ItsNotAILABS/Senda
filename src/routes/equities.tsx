import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { LISTED_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/equities")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Listed" pages={LISTED_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
