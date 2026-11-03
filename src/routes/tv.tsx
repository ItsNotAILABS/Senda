import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { TvDesk } from "@/components/tv-desk";

export const Route = createFileRoute("/tv")({
  component: TvPage,
});

function TvPage() {
  return (
    <AppShell>
      <TvDesk />
    </AppShell>
  );
}
