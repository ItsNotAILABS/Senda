import { createFileRoute } from "@tanstack/react-router";
import { UtilityAIDesk } from "@/components/utility-ai-desk";

export const Route = createFileRoute("/agents/intelligence")({
 component: UtilityIntelligenceRoute,
});

function UtilityIntelligenceRoute(){
 return <UtilityAIDesk/>;
}
