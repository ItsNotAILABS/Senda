import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PaymentsDesk } from "@/components/payments-desk";

type PaySearch = { act?: string; from?: string };

export const Route = createFileRoute("/payments")({
  validateSearch: (raw: Record<string, unknown>): PaySearch => {
    const act = typeof raw.act === "string" ? raw.act : undefined;
    const from = typeof raw.from === "string" ? raw.from : undefined;
    return { ...(act ? { act } : {}), ...(from ? { from } : {}) };
  },
  component: PaymentsPage,
});

function PaymentsPage() {
  const { act, from } = Route.useSearch();
  return (
    <AppShell>
      <PaymentsDesk initialAct={act} initialFrom={from} />
    </AppShell>
  );
}
