import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RevolutDesk } from "@/components/revolut-desk";

export const Route = createFileRoute("/revolut")({
  component: RevolutPage,
});

function RevolutPage() {
  return (
    <AppShell>
      <RevolutDesk />
    </AppShell>
  );
}
