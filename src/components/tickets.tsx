import { Check } from "lucide-react";
import { TIERS, type TierId } from "@/lib/event";
import type { CapacityMap } from "@/lib/rsvp";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Tickets({
  capacity,
}: {
  capacity: CapacityMap | null;
}) {
  return (
    <section id="tickets" className="scroll-mt-16 border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-12 max-w-2xl">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Tickets
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Three rooms. One guest list.
          </h2>
          <p className="mt-3 text-muted">
            Every seat is free. Capacity is not. Core Circle is already at the
            wall — join the waitlist if you want the dinner.
          </p>
        </header>
        <ul className="grid gap-4 lg:grid-cols-3">
          {TIERS.map((tier) => {
            const cap = capacity?.[tier.id];
            const remaining = cap?.remaining ?? Math.max(0, tier.capacity - tier.seedClaimed);
            const claimed = cap?.claimed ?? Math.min(tier.seedClaimed, tier.capacity);
            const waitlist = remaining === 0;
            const pct = Math.round((claimed / tier.capacity) * 100);
            return (
              <li
                key={tier.id}
                className={cn(
                  "flex flex-col rounded-2xl bg-surface p-6 shadow-panel",
                  waitlist && "opacity-90",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-semibold tracking-tight">
                      {tier.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted">{tier.blurb}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs tracking-widest text-accent uppercase">
                    {tier.price}
                  </span>
                </div>
                <ul className="mt-5 space-y-2">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span className="text-muted">
                      {waitlist
                        ? "At capacity"
                        : `${remaining} of ${tier.capacity} left`}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-subtle">
                      {claimed}/{tier.capacity}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-elevated"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${tier.name} capacity`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        waitlist ? "bg-muted" : "bg-accent",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <Button
                  className="mt-6 w-full"
                  variant={waitlist ? "outline" : "default"}
                  onClick={() => {
                    const form = document.getElementById("rsvp");
                    form?.scrollIntoView({ behavior: "smooth" });
                    window.dispatchEvent(
                      new CustomEvent("summit:select-tier", {
                        detail: tier.id as TierId,
                      }),
                    );
                  }}
                >
                  {waitlist ? "Join waitlist" : "Claim this seat"}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
