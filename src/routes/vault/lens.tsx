import { createFileRoute } from "@tanstack/react-router";
import { LensDesk } from "@/components/lens-desk";

export const Route = createFileRoute("/vault/lens")({
  component: Page,
});

function Page() {
  return <LensDesk />;
}
