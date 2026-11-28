import { createFileRoute } from "@tanstack/react-router";
import { MeterDesk } from "@/components/meter-desk";

export const Route = createFileRoute("/agents/meter")({
  component: MeterDesk,
});
