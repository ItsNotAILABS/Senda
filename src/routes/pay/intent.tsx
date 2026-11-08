import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { IntentPaymentDesk } from "@/components/intent-payment-desk";
export const Route=createFileRoute("/pay/intent")({component:Page});
function Page(){return <AppShell><main className="mx-auto max-w-3xl p-4"><IntentPaymentDesk/></main></AppShell>}
