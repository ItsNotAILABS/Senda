import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlobalDesk } from "@/components/global-desk";

export const Route = createFileRoute("/global")({
  component: () => (
    <AppShell>
      <GlobalDesk />
    </AppShell>
  ),
});
