import { createFileRoute } from "@tanstack/react-router";
import { MoneyRailView } from "@/components/money-rail-view";
export const Route = createFileRoute("/payments/add")({component: Page});
function Page(){return <MoneyRailView mode="add"/>;}
