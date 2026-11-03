import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ClaimDesk } from "@/components/claim-desk";

export const Route = createFileRoute("/gift")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <ClaimDesk />
    </AppShell>
  );
}
