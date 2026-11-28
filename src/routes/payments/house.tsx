import { createFileRoute } from "@tanstack/react-router";
import { HouseRailsDesk } from "@/components/house-rails-desk";

export const Route = createFileRoute("/payments/house")({
  component: Page,
});

function Page() {
  return (
    <div className="px-3 py-3 lg:px-4">
      <HouseRailsDesk />
    </div>
  );
}
