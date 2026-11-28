import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlobalPassport } from "@/components/global-passport";

export const Route = createFileRoute("/passport")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <GlobalPassport />
    </AppShell>
  );
}
