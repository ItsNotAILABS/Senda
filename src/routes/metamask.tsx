import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { BaseAccount } from "@/components/base-account";

export const Route = createFileRoute("/metamask")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <BaseAccount />
    </AppShell>
  );
}
