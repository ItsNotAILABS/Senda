import { createFileRoute } from "@tanstack/react-router";
import { LaunchDesk } from "@/components/launch-desk";

export const Route = createFileRoute("/solana/launch")({
  component: Page,
});

function Page() {
  return (
    <div className="px-3 py-3 lg:px-4">
      <LaunchDesk />
    </div>
  );
}
