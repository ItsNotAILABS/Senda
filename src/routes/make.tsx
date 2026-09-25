import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MakeDesk } from "@/components/make-desk";

export const Route = createFileRoute("/make")({
  component: MakePage,
});

function MakePage() {
  return (
    <AppShell>
      <MakeDesk />
    </AppShell>
  );
}
