import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const HOWTO_KEY = "senda.howto.v1";

const STEPS = [
  {
    n: "1",
    title: "Wallet",
    body: "USD, EUR, GBP, MXN, SOL in one cash account. Add with a debit card or Phantom USDC/SOL. This book is paper.",
  },
  {
    n: "2",
    title: "Send",
    body: "Pay an @tag instantly or a bank same day. Fee is $0. Revolut Standard takes 1% on weekend FX and a SWIFT cut on some sends.",
  },
  {
    n: "3",
    title: "Cards",
    body: "Issue virtual, metal, fleet, or single-use debit. Freeze, show PAN, spend cap. Disposable rotates after a spend.",
  },
  {
    n: "4",
    title: "Invest",
    body: "PreStocks on Solana. Last vs mark. Insure last is a week put. Cover tab is phone, travel, rent, life.",
  },
] as const;

export function HowToPlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-elevated p-5 shadow-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-subtle uppercase">Senda</p>
            <h2 id="how-title" className="mt-1 text-xl font-semibold tracking-tight">
              How this works
            </h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bg text-sm font-semibold">
                {s.n}
              </span>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
