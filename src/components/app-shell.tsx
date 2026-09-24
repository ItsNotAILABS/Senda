import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readChain } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Portfolio" },
  { to: "/pre", label: "Pre-IPO" },
  { to: "/agents", label: "Agents" },
  { to: "/invest", label: "Trade" },
  { to: "/payments", label: "Move" },
  { to: "/cards", label: "Cards" },
  { to: "/social", label: "Play" },
  { to: "/cover", label: "Cover" },
  { to: "/solana", label: "Solana" },
  { to: "/books", label: "Books" },
  { to: "/wallet", label: "Money" },
  { to: "/more", label: "Account" },
] as const;

function tabOn(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const { w } = useWallet();
  const owner = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className="sticky top-0 flex h-dvh w-52 shrink-0 flex-col border-r border-border bg-bg">
        <Link to="/" className="px-4 pt-5 font-display text-2xl tracking-tight">
          Senda
        </Link>
        <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
          {TABS.map((t) => {
            const on = tabOn(pathname, t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  on ? "bg-fg font-semibold text-bg" : "text-muted hover:bg-elevated hover:text-fg",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <ChainChip owner={owner} />
          <div className="mt-3">
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
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ChainChip({ owner }: { owner: string }) {
  const [usdc, setUsdc] = useState<number | null>(null);
  useEffect(() => {
    if (!owner) {
      setUsdc(null);
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((s) => live && setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0))
        .catch(() => live && setUsdc(null));
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);
  return (
    <Link to="/wallet" className="block rounded-lg px-1 py-1 hover:bg-elevated">
      <p className="font-mono text-sm">{owner ? (usdc == null ? "…" : `$${usdc.toFixed(2)}`) : "Your money"}</p>
      <p className="text-[10px] text-subtle">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Phantom is a source"}</p>
    </Link>
  );
}
