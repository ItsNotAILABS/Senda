import { createFileRoute } from "@tanstack/react-router";
import { AccountSwitch } from "@/components/account-switch";
import { AppShell } from "@/components/app-shell";
import { MoreDesk } from "@/components/more-desk";

export const Route = createFileRoute("/more")({
  component: MorePage,
});

function MorePage() {
  return (
    <AppShell>
      <AccountSwitch />
      <MoreDesk />
    </AppShell>
  );
}
