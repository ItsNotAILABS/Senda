import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CoverDesk } from "@/components/cover-desk";

export const Route = createFileRoute("/cover")({
  component: CoverPage,
});

function CoverPage() {
  return (
    <AppShell>
      <CoverDesk />
    </AppShell>
  );
}
