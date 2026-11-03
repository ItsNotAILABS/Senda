import { createFileRoute } from "@tanstack/react-router";
import { AcceptDesk } from "@/components/accept-desk";

type Search = { to?: string; amount?: string; memo?: string };

export const Route = createFileRoute("/payments/accept")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search.to === "string" && search.to) out.to = search.to;
    if (typeof search.amount === "string" && search.amount) out.amount = search.amount;
    else if (typeof search.amount === "number" && search.amount > 0) out.amount = String(search.amount);
    if (typeof search.memo === "string" && search.memo) out.memo = search.memo;
    return out;
  },
  component: Page,
});

function Page() {
  const { to, amount, memo } = Route.useSearch();
  return <AcceptDesk initialTo={to ?? ""} initialUsd={amount ?? ""} initialMemo={memo ?? ""} />;
}
