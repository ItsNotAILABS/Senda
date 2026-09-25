import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BookOpen,
  Bot,
  CreditCard,
  Gamepad2,
  Hexagon,
  LayoutGrid,
  Lock,
  Shield,
  Sparkles,
  SquarePen,
  UserRound,
  Wallet,
  Waypoints,
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
  { to: "/invest", label: "Trade", icon: Waypoints },
  { to: "/wallet", label: "Convert", icon: ArrowLeftRight },
  { to: "/vault", label: "Vault", icon: Lock },
  { to: "/social", label: "Play", icon: Gamepad2 },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/work", label: "Work", icon: SquarePen },
  { to: "/payments", label: "Send", icon: Wallet },
] as const;

const MORE = [
  { to: "/cards", label: "Cards", icon: CreditCard },
  { to: "/cover", label: "Cover", icon: Shield },
  { to: "/solana", label: "Solana", icon: Hexagon },
  { to: "/books", label: "Books", icon: BookOpen },
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

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-border bg-[#07070f]">
        <Link to="/" className="flex items-center gap-2 px-4 pt-4 pb-3">
          <span className="size-6 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195]" />
          <span className="font-display text-lg tracking-tight">Senda</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
          {PRIMARY.map((t) => (
            <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} />
          ))}
          <p className="mt-4 px-3 font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">More</p>
          {MORE.map((t) => (
            <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} quiet />
          ))}
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
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
          <form
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              void navigate({ to: "/pre", search: { q } });
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a company"
              className="min-h-10 w-full rounded-full border border-border bg-surface px-4 text-sm outline-none"
            />
          </form>
          <div className="relative">
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
        </header>
        {children}
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
  to: "/" | "/pre" | "/invest" | "/wallet" | "/vault" | "/social" | "/agents" | "/work" | "/payments" | "/cards" | "/cover" | "/solana" | "/books" | "/more";
  label: string;
  icon: typeof LayoutGrid;
  on: boolean;
  quiet?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
        on ? "bg-accent font-semibold text-accent-fg" : quiet ? "text-subtle hover:bg-elevated hover:text-fg" : "text-muted hover:bg-elevated hover:text-fg",
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
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
