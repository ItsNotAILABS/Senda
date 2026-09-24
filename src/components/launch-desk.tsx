import { Link } from "@tanstack/react-router";
import { PROGRAM_ID, FEE_BPS } from "@/lib/senda-program";

export function LaunchDesk() {
  return (
    <div className="px-4 pb-8">
      <h2 className="mt-1 font-display text-3xl tracking-tight">The names already trade</h2>
      <p className="mt-2 text-sm text-muted">
        PreStocks are issued as SPL tokens. You buy, hold, and sell them here. Nothing opens another site.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <Link to="/pre" className="flex min-h-12 items-center justify-center rounded-full bg-fg text-sm font-semibold text-bg">
          Buy a PreStock
        </Link>
        <Link to="/wallet" className="flex min-h-12 items-center justify-center rounded-full bg-elevated text-sm font-semibold">
          Convert from SOL
        </Link>
      </div>
      <p className="mt-8 font-mono text-[11px] leading-relaxed text-subtle">
        Agency program {PROGRAM_ID}
        <br />
        route_fill · fee {FEE_BPS} bps · the route is built here · you sign it
      </p>
    </div>
  );
}
