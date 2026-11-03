import { createFileRoute } from "@tanstack/react-router";
import { WorldDesk } from "@/components/world-desk";
export const Route = createFileRoute("/invest/world")({
  component: () => <WorldDesk />,
});
