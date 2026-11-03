import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { SpotPage } from "@/components/spot-page";

export const Route = createFileRoute("/radar")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <SpotPage />
    </AppShell>
  );
}
