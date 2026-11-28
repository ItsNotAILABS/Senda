import { createFileRoute } from "@tanstack/react-router";
import { ContractsPage } from "@/components/contracts-page";

export const Route = createFileRoute("/make/contracts")({
  component: Page,
});

function Page() {
  return <ContractsPage />;
}
