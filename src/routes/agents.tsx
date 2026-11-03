import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { AGENT_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/agents")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Agents" pages={AGENT_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
