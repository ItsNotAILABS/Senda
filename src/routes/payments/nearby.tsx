import { createFileRoute } from "@tanstack/react-router";
import { MoneyRailView } from "@/components/money-rail-view";
export const Route = createFileRoute("/payments/nearby")({component: Page});
function Page(){return <MoneyRailView mode="nearby"/>;}
