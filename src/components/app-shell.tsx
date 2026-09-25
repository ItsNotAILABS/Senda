import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BookOpen,
  Bot,
  CreditCard,
  FileText,
  Gamepad2,
  Hexagon,
  LayoutGrid,
  Lock,
  Shield,
  Sparkles,
  Store,
  SquarePen,
  UserRound,
  Wallet,
  Zap,
  Bell,
} from "lucide-react";
import { Onboard } from "@/components/onboard";
import { WalletPicker } from "@/components/wallet-picker";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readChain } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { to: "/", label: "Home", icon: LayoutGrid },
  { to: "/pre", label: "PreStocks", icon: Sparkles },
  { to: "/wallet", label: "Convert", icon: ArrowLeftRight },
  { to: "/social", label: "Play", icon: Gamepad2 },
  { to: "/cards", label: "Shop", icon: CreditCard },
  { to: "/make", label: "Make", icon: Store },
  { to: "/agents", label: "AI Agent", icon: Bot },
  { to: "/payments", label: "Send", icon: Wallet },
  { to: "/vault", label: "Portfolio", icon: Lock },
] as const;

const MORE = [
  { to: "/cover", label: "Cover", icon: Shield },
  { to: "/work", label: "Work", icon: SquarePen },
  { to: "/invest", label: "Trade", icon: Hexagon },
  { to: "/solana", label: "Solana", icon: Hexagon },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/docs", label: "Docs", icon: FileText },
  { to: "/more", label: "Account", icon: UserRound },
] as const;

function tabOn(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const { w } = useWallet();
  const owner = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [q, setQ] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const link = w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const home = pathname === "/";

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-border bg-[#07070f]">
        <Link to="/" className="flex items-center gap-2 px-4 pt-5 pb-4">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-accent-fg">
            <Zap className="size-4" />
          </span>
          <span className="font-display text-lg tracking-tight">Senda</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {PRIMARY.map((t) => (
            <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} />
          ))}
          <div className="mt-4 border-t border-white/8 pt-3">
            {MORE.map((t) => (
              <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} quiet />
            ))}
          </div>
        </nav>
        <div className="border-t border-border px-3 py-3">
          <ChainChip owner={owner} />
          <div className="mt-2 px-1">
            {isPending ? (
              <div className="size-6 animate-pulse rounded-full bg-elevated" />
            ) : user ? (
              <SignedIn>
                <UserButton />
              </SignedIn>
            ) : (
              <SignedOut>
                <Link to="/login" className="text-xs text-muted hover:text-fg">
                  Sign in
                </Link>
              </SignedOut>
            )}
            <Link to="/legal" className="mt-2 block px-1 text-[11px] text-subtle hover:text-fg">
              Privacy
            </Link>
          </div>
        </div>
      </aside>
      <div className="senda-stage min-w-0 flex-1">
        <header className={cn("sticky top-0 z-20 px-4 py-3", home && "pointer-events-none")}>
          <div className={cn("flex items-center gap-3", home && "justify-end")}>
            {home ? null : (
            <form
              className="min-w-0 w-full flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                const key = q.trim().toLowerCase();
                setQ("");
                if (key === "send") void navigate({ to: "/payments" });
                else if (key === "add") void navigate({ to: "/payments", search: { act: "add" } });
                else if (key === "card" || key === "cards" || key === "shop") void navigate({ to: "/cards", search: { spend: 0 } });
                else if (key === "exchange" || key === "convert") void navigate({ to: "/wallet" });
                else if (key === "vault" || key === "portfolio") void navigate({ to: "/vault" });
                else if (key === "cover") void navigate({ to: "/cover" });
                else if (key === "play") void navigate({ to: "/social" });
                else if (key === "agent" || key === "agents") void navigate({ to: "/agents" });
                else if (key === "work") void navigate({ to: "/work" });
                else if (key === "trade") void navigate({ to: "/invest" });
                else if (key === "docs" || key === "doc") void navigate({ to: "/docs" });
                else if (key === "home") void navigate({ to: "/" });
                else void navigate({ to: "/pre", search: { q: key } });
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search companies, tickers, or anything…"
                className="min-h-11 w-full rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none"
              />
            </form>
            )}
            {home ? null : (
            <span className="grid size-10 place-items-center rounded-full border border-white/10 text-muted">
              <Bell className="size-4" />
            </span>
            )}
            <div className={cn("relative", home && "pointer-events-auto")}>
              {link ? (
                <Link to="/wallet" className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-3 text-sm">
                  {link.label} · {link.address.slice(0, 4)}…
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setConnectOpen((v) => !v)}
                  className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
                >
                  Connect Phantom
                </button>
              )}
              {connectOpen && !link ? (
                <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-border bg-surface p-3 shadow-border">
                  <WalletPicker />
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div key={pathname} className="senda-rise">
          {children}
        </div>
        <Onboard />
      </div>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  on,
  quiet,
}: {
  to: "/" | "/pre" | "/invest" | "/wallet" | "/vault" | "/social" | "/agents" | "/work" | "/payments" | "/cards" | "/make" | "/cover" | "/solana" | "/books" | "/docs" | "/more";
  label: string;
  icon: typeof LayoutGrid;
  on: boolean;
  quiet?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm",
        on ? "bg-white/8 font-medium text-fg" : quiet ? "text-subtle hover:bg-white/5 hover:text-fg" : "text-muted hover:bg-white/5 hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0", on ? "text-accent" : "")} strokeWidth={1.75} />
      {label}
    </Link>
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
    <Link to="/wallet" className="block rounded-lg bg-bg px-2.5 py-1.5 hover:bg-elevated">
      <p className="font-mono text-xs text-fg">{owner ? (usdc == null ? "…" : `$${usdc.toFixed(2)} USDC`) : "Your money"}</p>
      <p className="font-mono text-[10px] text-subtle">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected"}</p>
    </Link>
  );
}
