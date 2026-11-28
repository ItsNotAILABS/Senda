import { createFileRoute } from "@tanstack/react-router";
import { BullishDesk } from "@/components/bullish-desk";

export const Route = createFileRoute("/equities/bullish")({
  component: Page,
});

function Page() {
  return <BullishDesk />;
}
