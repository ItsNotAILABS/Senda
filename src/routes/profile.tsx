import { createFileRoute } from "@tanstack/react-router";
import { AccountSwitch } from "@/components/account-switch";
import { AppShell } from "@/components/app-shell";
import { ProfileDesk } from "@/components/profile-desk";

export const Route = createFileRoute("/profile")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <AccountSwitch />
      <ProfileDesk />
    </AppShell>
  );
}
