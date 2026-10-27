import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PaymentsDesk } from "@/components/payments-desk";

type PaySearch = {
  act?: string;
  from?: string;
  to?: string;
  usd?: string;
  memo?: string;
  rail?: string;
  ccy?: string;
  what?: string;
};

export const Route = createFileRoute("/payments")({
  validateSearch: (raw: Record<string, unknown>): PaySearch => {
    const pick = (k: string) => (typeof raw[k] === "string" ? raw[k] : undefined);
    const act = pick("act");
    const from = pick("from");
    const to = pick("to");
    const usd = pick("usd");
    const memo = pick("memo");
    const rail = pick("rail");
    const ccy = pick("ccy");
    const what = pick("what");
    return {
      ...(act ? { act } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(usd ? { usd } : {}),
      ...(memo ? { memo } : {}),
      ...(rail ? { rail } : {}),
      ...(ccy ? { ccy } : {}),
      ...(what ? { what } : {}),
    };
  },
  component: PaymentsPage,
});

function PaymentsPage() {
  const { act, from, to, usd, memo, rail, ccy, what } = Route.useSearch();
  return (
    <AppShell>
      <PaymentsDesk
        initialAct={act}
        initialFrom={from}
        initialTo={to}
        initialUsd={usd}
        initialMemo={memo}
        initialRail={rail}
        initialCcy={ccy}
        initialWhat={what}
      />
    </AppShell>
  );
}
