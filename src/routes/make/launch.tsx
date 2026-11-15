import { createFileRoute } from "@tanstack/react-router";
import { BundleDesk } from "@/components/bundle-desk";

export const Route = createFileRoute("/make/launch")({
  component: Page,
});

function Page() {
  return <BundleDesk />;
}
