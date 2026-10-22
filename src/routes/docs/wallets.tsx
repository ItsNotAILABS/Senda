import { createFileRoute } from "@tanstack/react-router";
import { DocsView } from "@/components/desk-views";
export const Route = createFileRoute("/docs/wallets")({
  component: Page,
});

function Page() {
  return <DocsView book="wallets" />;
}
