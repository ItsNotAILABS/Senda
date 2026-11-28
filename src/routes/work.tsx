import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/work")({
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
