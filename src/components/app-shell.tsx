import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatMoney, totalUsd } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { to: "/", label: "Portfolio" },
  { to: "/invest", label: "Trade" },
  { to: "/payments", label: "Move" },
  { to: "/cards", label: "Cards" },
] as const;

const SECONDARY = [
  { to: "/social", label: "Play" },
  { to: "/cover", label: "Cover" },
  { to: "/solana", label: "Solana" },
  { to: "/books", label: "Books" },
  { to: "/more", label: "Account" },
] as const;

function tabOn(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const { w, usdPer } = useWallet();
  const total = totalUsd(w, usdPer);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="font-display text-2xl tracking-tight">
            Senda
          </Link>
          <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
            {PRIMARY.map((t) => {
              const on = tabOn(pathname, t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium",
                    on ? "bg-fg text-bg" : "text-fg hover:bg-elevated",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
            <span className="mx-2 h-4 w-px bg-border" />
            {SECONDARY.map((t) => {
              const on = tabOn(pathname, t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn("rounded-lg px-2 py-1.5 text-sm", on ? "text-fg" : "text-subtle hover:text-fg")}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Link to="/payments" search={{ act: "add" }} className="text-right">
              <p className="font-mono text-sm">{formatMoney(total, "USD")}</p>
              <p className="text-[10px] text-subtle">{w.tag}</p>
            </Link>
            {isPending ? (
              <div className="size-8 animate-pulse rounded-full bg-elevated" />
            ) : user ? (
              <SignedIn>
                <UserButton />
              </SignedIn>
            ) : (
              <SignedOut>
                <Link to="/login" className="text-sm text-muted hover:text-fg">
                  Sign in
                </Link>
              </SignedOut>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {[...PRIMARY, ...SECONDARY].map((t) => {
            const on = tabOn(pathname, t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-sm",
                  on ? "bg-fg text-bg" : "text-muted",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="w-full">{children}</div>
    </div>
  );
}
