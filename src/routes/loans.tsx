import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LoansDesk } from "@/components/loans-desk";

export const Route = createFileRoute("/loans")({
  component: LoansPage,
});

function LoansPage() {
  return (
    <AppShell>
      <LoansDesk />
    </AppShell>
  );
}
