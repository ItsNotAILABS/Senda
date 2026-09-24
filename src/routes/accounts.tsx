import { createFileRoute } from "@tanstack/react-router";
import { AccountsDesk } from "@/components/accounts-desk";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/accounts")({
  component: AccountsPage,
});

function AccountsPage() {
  return (
    <AppShell>
      <AccountsDesk />
    </AppShell>
  );
}
