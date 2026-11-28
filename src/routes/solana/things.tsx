import { createFileRoute } from "@tanstack/react-router";
import { ThingDesk } from "@/components/thing-desk";

export const Route = createFileRoute("/solana/things")({
  component: Page,
});

function Page() {
  return (
    <div className="px-3 py-3 lg:px-4">
      <ThingDesk />
    </div>
  );
}
