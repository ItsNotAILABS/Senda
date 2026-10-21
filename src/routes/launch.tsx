import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LaunchDesk } from "@/components/launch-desk";

export const Route = createFileRoute("/launch")({
  component: LaunchPage,
});

function LaunchPage() {
  return (
    <AppShell>
      <LaunchDesk />
    </AppShell>
  );
}
