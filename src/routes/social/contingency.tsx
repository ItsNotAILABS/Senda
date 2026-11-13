import {createFileRoute} from "@tanstack/react-router";
import {EventMarketsDesk} from "@/components/event-markets-desk";

export const Route=createFileRoute("/social/contingency")({
 component:ContingencyStudioRoute,
});
function ContingencyStudioRoute(){return <EventMarketsDesk initialWorkspace="contingency"/>;}
