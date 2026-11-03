import { createFileRoute } from "@tanstack/react-router";
import { SolanaView } from "@/components/desk-views";

export const Route = createFileRoute("/solana/")({
  component: Page,
});

function Page() {
  return <SolanaView view="mints" />;
}
