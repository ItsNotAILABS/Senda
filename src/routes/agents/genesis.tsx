import { createFileRoute } from "@tanstack/react-router";
import { GenesisDesk } from "@/components/genesis-desk";

export const Route = createFileRoute("/agents/genesis")({
  component: Page,
});

function Page() {
  return <GenesisDesk />;
}
