import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RevolutAccount } from "@/components/revolut-account";

export const Route = createFileRoute("/revolut")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RevolutAccount />
    </AppShell>
  );
}
