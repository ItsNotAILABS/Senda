import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProductShell } from "@/components/product-shell";
import { CONVERT_PAGES } from "@/lib/product-pages";

export const Route = createFileRoute("/wallet")({
  validateSearch: (raw: Record<string, unknown>): { buy?: string } => {
    const buy = typeof raw.buy === "string" ? raw.buy : undefined;
    return buy ? { buy } : {};
  },
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <ProductShell title="Convert" pages={CONVERT_PAGES}>
        <Outlet />
      </ProductShell>
    </AppShell>
  );
}
