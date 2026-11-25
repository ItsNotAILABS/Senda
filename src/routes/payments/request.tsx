import { createFileRoute } from "@tanstack/react-router";
import { MoneyRailView } from "@/components/money-rail-view";
export const Route = createFileRoute("/payments/request")({component: Page});
function Page(){return <MoneyRailView mode="request"/>;}
