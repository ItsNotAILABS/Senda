import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { PLAY_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/social")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Play" pages={PLAY_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
