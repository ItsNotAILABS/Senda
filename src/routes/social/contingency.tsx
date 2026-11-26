import { createFileRoute } from "@tanstack/react-router";
import { EventMarketsDesk } from "@/components/event-markets-v3";

export const Route = createFileRoute("/social/contingency")({
  component: ContingencyLabPage,
});
function ContingencyLabPage() {
  return <EventMarketsDesk initialWorkspace="contingency" />;
}
