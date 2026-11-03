import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PhantomAccount } from "@/components/phantom-account";

export const Route = createFileRoute("/phantom")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PhantomAccount />
    </AppShell>
  );
}
