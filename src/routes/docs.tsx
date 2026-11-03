import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { DOCS_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/docs")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Docs" pages={DOCS_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
