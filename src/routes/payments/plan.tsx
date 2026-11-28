import { createFileRoute } from "@tanstack/react-router";
import { TransferAgent } from "@/components/transfer-agent";

export const Route = createFileRoute("/payments/plan")({
  component: Page,
});

function Page() {
  return (
    <div className="px-3 py-3 lg:px-4">
      <TransferAgent surface="plan" />
    </div>
  );
}
