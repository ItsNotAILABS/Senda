import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { BOOK_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/books")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Books" pages={BOOK_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
