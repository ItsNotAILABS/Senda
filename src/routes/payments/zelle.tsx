import { createFileRoute } from "@tanstack/react-router";
import { ZelleDesk } from "@/components/zelle-desk";

export const Route = createFileRoute("/payments/zelle")({
  component: Page,
});

function Page() {
  return <ZelleDesk />;
}
