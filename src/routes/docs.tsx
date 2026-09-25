import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { DocsDesk } from "@/components/docs-desk";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
});

function DocsPage() {
  return (
    <AppShell>
      <DocsDesk />
    </AppShell>
  );
}
