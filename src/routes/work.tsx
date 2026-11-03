import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { WORK_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/work")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Work" pages={WORK_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
