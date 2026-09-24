import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CircleHelp, KeyRound } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SIMULATED_BANNER, formatChips } from "@/lib/markets";
import { cn } from "@/lib/utils";

export function SimulatedBanner() {
  return (
    <div className="border-b border-border bg-elevated">
      <p className="px-3 py-1.5 text-center font-mono text-xs tracking-wide text-muted uppercase">
        {SIMULATED_BANNER}
      </p>
    </div>
  );
}

export function PitHeader({
  chips,
  frozen,
  onHowTo,
}: {
  chips: number;
  frozen?: boolean;
  onHowTo?: () => void;
}) {
  const { user, isPending } = useCurrentUserState();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/92 backdrop-blur-md">
      <SimulatedBanner />
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-3 sm:h-16 sm:px-4">
        <Link
          to="/"
          className="flex min-h-11 items-center font-semibold tracking-tight text-fg"
        >
          PIT
        </Link>
        <span className="hidden text-sm text-subtle sm:inline">PreStocks</span>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {frozen ? (
            <span className="rounded-md bg-accent px-2 py-1 font-mono text-xs text-accent-fg uppercase">
              Frozen
            </span>
          ) : null}
          <span className="rounded-full bg-elevated px-3 py-1.5 text-sm font-semibold tabular-nums text-fg" suppressHydrationWarning>
            ${formatChips(chips)}
          </span>
          {onHowTo ? (
            <button
              type="button"
              onClick={onHowTo}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
              aria-label="How this works"
            >
              <CircleHelp className="size-4" strokeWidth={1.75} />
            </button>
          ) : null}
          <Link
            to="/accounts"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
            aria-label="Accounts"
          >
            <KeyRound className="size-4" strokeWidth={1.75} />
          </Link>
          {isPending ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-elevated" />
          ) : user ? (
            <SignedIn>
              <UserButton />
            </SignedIn>
          ) : (
            <SignedOut>
              <Link to="/login" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-fg">
                Sign in
              </Link>
            </SignedOut>
          )}
        </div>
      </div>
    </header>
  );
}

export function PitShell({
  chips,
  frozen,
  children,
  className,
  onHowTo,
}: {
  chips: number;
  frozen?: boolean;
  children: ReactNode;
  className?: string;
  onHowTo?: () => void;
}) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-bg text-fg", className)}>
      <PitHeader chips={chips} frozen={frozen} onHowTo={onHowTo} />
      {children}
    </div>
  );
}
