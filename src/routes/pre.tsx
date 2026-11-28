import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

type PreSearch = { q?: string };

export const Route = createFileRoute("/pre")({
  validateSearch: (search: Record<string, unknown>): PreSearch => {
    const q = typeof search.q === "string" ? search.q : "";
    return q ? { q } : {};
  },
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
