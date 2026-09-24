import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MoreDesk } from "@/components/more-desk";

export const Route = createFileRoute("/more")({
  component: MorePage,
});

function MorePage() {
  return (
    <AppShell>
      <MoreDesk />
    </AppShell>
  );
}
