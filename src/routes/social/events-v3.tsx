import { createFileRoute } from "@tanstack/react-router";
import { EventMarketsDesk } from "@/components/event-markets-v3";

export const Route = createFileRoute("/social/events-v3")({
  component: EventsV3Page,
});
function EventsV3Page() {
  return <EventMarketsDesk initialWorkspace="markets" />;
}
