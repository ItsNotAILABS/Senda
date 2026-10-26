import { createFileRoute } from "@tanstack/react-router";
import { InterfaceStudio } from "@/components/interface-studio";

export const Route = createFileRoute("/work/interface")({
  component: InterfacePage,
});

function InterfacePage() {
  return <InterfaceStudio />;
}
