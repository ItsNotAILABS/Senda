import { createFileRoute } from "@tanstack/react-router";
import { EventRails } from "@/components/event-rails";

export const Route = createFileRoute("/payments/rails")({
  component: Page,
});

function Page() {
  return (
    <div className="px-3 py-3 lg:px-4">
      <EventRails />
    </div>
  );
}
