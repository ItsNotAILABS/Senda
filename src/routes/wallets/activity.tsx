import { createFileRoute } from "@tanstack/react-router";
import { ActivityDesk } from "@/components/activity-desk";

export const Route = createFileRoute("/wallets/activity")({
  component: Page,
});

function Page() {
  return (
    <div className="px-3 py-3 lg:px-4">
      <ActivityDesk />
    </div>
  );
}
