import { createFileRoute } from "@tanstack/react-router";
import { EdgeDesk } from "@/components/edge-desk";

export const Route = createFileRoute("/solana/edges")({
  component: Page,
});

function Page() {
  return (
    <div className="px-3 py-3 lg:px-4">
      <EdgeDesk />
    </div>
  );
}
