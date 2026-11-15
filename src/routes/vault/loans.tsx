import { createFileRoute } from "@tanstack/react-router";
import { LoansDesk } from "@/components/loans-desk";

export const Route = createFileRoute("/vault/loans")({
  component: Page,
});

function Page() {
  return <LoansDesk nav={false} />;
}
