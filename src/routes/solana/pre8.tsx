import { createFileRoute } from "@tanstack/react-router";
import { SolanaView } from "@/components/desk-views";
export const Route = createFileRoute("/solana/pre8")({
  component: Page,
});

function Page() {
  return <SolanaView view="index" />;
}
