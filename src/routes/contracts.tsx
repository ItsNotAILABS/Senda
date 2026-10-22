import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ContractsPage } from "@/components/contracts-page";

export const Route = createFileRoute("/contracts")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <ContractsPage />
    </AppShell>
  );
}
