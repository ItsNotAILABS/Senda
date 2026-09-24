import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BookOpen,
  Bot,
  CreditCard,
  Gamepad2,
  Hexagon,
  LayoutGrid,
  Shield,
  Sparkles,
  UserRound,
  Wallet,
  Waypoints,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readChain } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Desk",
    tabs: [
      { to: "/", label: "Portfolio", icon: LayoutGrid },
      { to: "/pre", label: "Pre-IPO", icon: Sparkles },
      { to: "/invest", label: "Trade", icon: Waypoints },
      { to: "/agents", label: "Agents", icon: Bot },
    ],
  },
  {
    label: "Cash",
    tabs: [
      { to: "/wallet", label: "Money", icon: Wallet },
      { to: "/payments", label: "Move", icon: ArrowLeftRight },
      { to: "/cards", label: "Cards", icon: CreditCard },
    ],
  },
  {
    label: "More",
    tabs: [
      { to: "/social", label: "Play", icon: Gamepad2 },
      { to: "/cover", label: "Cover", icon: Shield },
      { to: "/solana", label: "Solana", icon: Hexagon },
      { to: "/books", label: "Books", icon: BookOpen },
      { to: "/more", label: "Account", icon: UserRound },
    ],
  },
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
      <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface">
        <Link to="/" className="flex items-center gap-2.5 px-4 pt-5">
          <span className="size-2.5 rounded-sm bg-accent" />
          <span className="font-display text-2xl tracking-tight">Senda</span>
        </Link>
        <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="px-2 font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">{g.label}</p>
              <div className="mt-1.5 flex flex-col gap-0.5">
                {g.tabs.map((t) => {
                  const on = tabOn(pathname, t.to);
                  const Icon = t.icon;
                  return (
                    <Link
                      key={t.to}
                      to={t.to}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-2 text-sm",
                        on
                          ? "border-accent bg-elevated font-medium text-fg"
                          : "border-transparent text-muted hover:bg-bg hover:text-fg",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", on ? "text-accent" : "text-subtle")} strokeWidth={1.75} />
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <ChainChip owner={owner} />
          <div className="mt-2 px-1">
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
    <Link to="/wallet" className="block rounded-xl bg-bg px-3 py-2.5 hover:bg-elevated">
      <p className="text-[10px] tracking-wide text-subtle uppercase">{owner ? "Phantom USDC" : "Wallet"}</p>
      <p className="mt-0.5 font-mono text-sm text-fg">{owner ? (usdc == null ? "…" : `$${usdc.toFixed(2)}`) : "Your money"}</p>
      <p className="font-mono text-[10px] text-subtle">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected"}</p>
    </Link>
  );
}
