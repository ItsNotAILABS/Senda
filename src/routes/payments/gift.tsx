import { createFileRoute } from "@tanstack/react-router";
import { GiftDesk } from "@/components/gift-desk";

export const Route = createFileRoute("/payments/gift")({
  component: Page,
});

function Page() {
  return <GiftDesk />;
}
