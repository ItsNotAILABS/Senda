import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PhantomDesk } from "@/components/phantom-desk";

export const Route = createFileRoute("/phantom")({
  component: PhantomPage,
});

function PhantomPage() {
  return (
    <AppShell>
      <PhantomDesk />
    </AppShell>
  );
}
