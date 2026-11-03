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
  KeyRound,
  LayoutGrid,
  LineChart,
  Lock,
  Menu,
  PanelLeft,
  Radar,
  Shield,
  Sparkles,
  Store,
  SquarePen,
  Tv,
  UserRound,
  Wallet,
  Zap,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { Onboard } from "@/components/onboard";
import { FillReceipt } from "@/components/fill-receipt";
import { WalletPicker } from "@/components/wallet-picker";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readChain, connectPhantom } from "@/lib/phantom";
import { connectWallet } from "@/lib/wallets";
import { jupTape, type TapeRow } from "@/lib/world-book";
import { sealOpen } from "@/lib/seal";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { to: "/", label: "Home", icon: LayoutGrid },
  { to: "/invest", label: "Trade", icon: Hexagon },
  { to: "/wire", label: "Markets", icon: Radar },
  { to: "/wallet", label: "Swap", icon: ArrowLeftRight },
  { to: "/social", label: "Predict", icon: Gamepad2 },
  { to: "/cards", label: "Pay", icon: CreditCard },
  { to: "/work", label: "Work", icon: SquarePen },
  { to: "/agents", label: "AI Agent", icon: Bot },
  { to: "/payments", label: "Send", icon: Wallet },
  { to: "/vault", label: "Portfolio", icon: Lock },
] as const;

const BOOKS = [
  { to: "/pre", label: "PreStocks" },
  { to: "/xstocks", label: "xStocks" },
  { to: "/radar", label: "Spot" },
] as const;

const MORE = [
  { to: "/cover", label: "Cover", icon: Shield },
  { to: "/launch", label: "Launch", icon: Zap },
  { to: "/contracts", label: "Contracts", icon: FileText },
  { to: "/market", label: "Protect", icon: Shield },
  { to: "/solana", label: "Solana", icon: Hexagon },
  { to: "/make", label: "Make", icon: Store },
  { to: "/accounts", label: "Accounts", icon: UserRound },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/docs", label: "Docs", icon: FileText },
  { to: "/more", label: "Account", icon: UserRound },
] as const;

const WALLETS = [
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/wallets/power", label: "Robinhood", icon: Zap },
  { to: "/revolut", label: "Revolut", icon: CreditCard },
  { to: "/phantom", label: "Phantom", icon: Zap },
  { to: "/metamask", label: "MetaMask", icon: Hexagon },
] as const;

type TabTo = (typeof PRIMARY)[number]["to"] | (typeof BOOKS)[number]["to"] | (typeof MORE)[number]["to"] | (typeof WALLETS)[number]["to"];

function tabOn(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const { w, linkChain } = useWallet();
  const owner = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [q, setQ] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sealed, setSealed] = useState(true);
  const [rail, setRail] = useState(true);
  const [booksOpen, setBooksOpen] = useState(false);
  const link = w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const home = pathname === "/";
  const booksOn = pathname === "/invest" || BOOKS.some((b) => tabOn(pathname, b.to));

  useEffect(() => {
    if (booksOn) setBooksOpen(true);
  }, [booksOn]);

  useEffect(() => {
    const sync = () => setSealed(!sealOpen());
    sync();
    window.addEventListener("senda-seal", sync);
    return () => window.removeEventListener("senda-seal", sync);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("rail.open");
    if (saved === "0") setRail(false);
    else if (saved == null && window.innerWidth < 1180) setRail(false);
  }, []);

  function toggleRail() {
    setRail((open) => {
      const next = !open;
      window.localStorage.setItem("rail.open", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-[#07070f] transition-[width] duration-200 lg:flex", rail ? "w-52" : "w-[68px]")}>
        <div className={cn("flex items-center pt-4 pb-3", rail ? "gap-2 px-3" : "justify-center px-2")}>
          <Link to="/" className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg" title="Senda">
            <Zap className="size-4" />
          </Link>
          {rail ? <span className="font-display text-[15px] tracking-tight">Senda</span> : null}
          <button
            type="button"
            onClick={toggleRail}
            aria-label={rail ? "Collapse the column" : "Open the column"}
            title={rail ? "Collapse" : "Open"}
            className={cn("grid size-8 place-items-center rounded-lg text-subtle hover:bg-white/5 hover:text-fg", rail ? "ml-auto" : "hidden")}
          >
            <PanelLeft className="size-4" />
          </button>
        </div>
        {!rail ? (
          <button
            type="button"
            onClick={toggleRail}
            aria-label="Open the column"
            title="Open"
            className="mx-auto mb-2 grid size-8 place-items-center rounded-lg text-subtle hover:bg-white/5 hover:text-fg"
          >
            <PanelLeft className="size-4" />
          </button>
        ) : null}
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
          {PRIMARY.map((t) => (
            <div key={t.to}>
              <div className="flex items-center">
                <div className="min-w-0 flex-1">
                  <NavLink to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to) || (t.to === "/invest" && booksOn)} compact={!rail} />
                </div>
                {t.to === "/invest" && rail ? (
                  <button type="button" aria-label="Books under Trade" onClick={() => setBooksOpen((v) => !v)} className="mr-1 rounded-lg px-2 py-1 text-xs text-subtle hover:bg-white/5">
                    {booksOpen ? "–" : "+"}
                  </button>
                ) : null}
              </div>
              {t.to === "/invest" && booksOpen && rail ? (
                <div className="ml-4 border-l border-white/10 pl-2">
                  {BOOKS.map((b) => (
                    <Link key={b.to} to={b.to} className={cn("block rounded-lg px-2 py-1.5 text-sm", tabOn(pathname, b.to) ? "font-medium text-fg" : "text-subtle hover:text-fg")}>
                      {b.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          <div className="mt-3 border-t border-white/8 pt-2">
            {MORE.map((t) => (
              <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} quiet compact={!rail} />
            ))}
          </div>
          <div className="mt-3 border-t border-white/8 pt-2">
            {WALLETS.map((t) => (
              <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} quiet compact={!rail} />
            ))}
          </div>
        </nav>
        <div className={cn("border-t border-border py-3", rail ? "px-2" : "px-2")}>
          <Link to="/vault" title="Vault" className={cn("mb-2 min-h-9 rounded-full bg-accent font-semibold text-accent-fg", rail ? "flex w-full items-center justify-center px-3 text-[12px]" : "mx-auto grid size-9 place-items-center")}>
            {rail ? "Vault" : <Lock className="size-3.5" />}
          </Link>
          {rail ? <ChainChip owner={owner} /> : null}
          <div className={cn("mt-2", rail ? "px-1" : "flex justify-center")}>
            {isPending ? (
              <div className="size-6 animate-pulse rounded-full bg-elevated" />
            ) : user ? (
              <SignedIn>
                <UserButton />
              </SignedIn>
            ) : (
              <SignedOut>
                <Link to="/login" className="text-[12px] text-muted hover:text-fg">
                  {rail ? "Sign in" : ""}
                </Link>
              </SignedOut>
            )}
            {rail ? (
              <Link to="/legal" className="mt-2 block px-1 text-[11px] text-subtle hover:text-fg">
                Privacy
              </Link>
            ) : null}
          </div>
        </div>
      </aside>
      <div className="senda-stage min-w-0 flex-1 pb-28 lg:pb-0">
        <header className={cn("sticky top-0 z-20 bg-bg/90 px-4 py-3 backdrop-blur", home && "pointer-events-none")}>
          <LiveTape />
          <MoneyLine owner={owner} />
          <div className={cn("flex items-center gap-2", home && "justify-end")}>
            {home ? null : (
            <form
              className="hidden min-w-0 w-full flex-1 lg:block"
              onSubmit={(e) => {
                e.preventDefault();
                const key = q.trim().toLowerCase();
                setQ("");
                if (key === "send") void navigate({ to: "/payments" });
                else if (key === "add") void navigate({ to: "/payments/add" });
                else if (key === "card" || key === "cards" || key === "shop") void navigate({ to: "/cards" });
                else if (key === "wallet" || key === "wallets") void navigate({ to: "/wallets" });
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
                className="min-h-9 w-full rounded-full border border-white/10 bg-black/40 px-4 text-[13px] outline-none"
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
                <Link to="/wallet" className="inline-flex min-h-10 items-center rounded-full bg-[#d7e36a] px-4 text-sm font-semibold text-black">
                  Phantom {link.address.slice(0, 4)}…
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void connectPhantom()
                      .then((addr) => {
                        const linked = linkChain(addr, "Phantom", "phantom");
                        if (!linked.ok && linked.error !== "Already linked.") toast.error(linked.error || "Phantom did not stay.");
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Phantom did not open."));
                  }}
                  className="inline-flex min-h-10 items-center rounded-full bg-[#d7e36a] px-4 text-sm font-semibold text-black"
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
            <button
              type="button"
              onClick={() => {
                void connectWallet("metamask")
                  .then((got) => {
                    const linked = linkChain(got.address, got.label, "evm");
                    if (!linked.ok && linked.error !== "Already linked.") toast.error(linked.error || "MetaMask did not stay.");
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "MetaMask did not open."));
              }}
              className={cn("inline-flex min-h-10 items-center rounded-full border border-white/15 px-3 text-sm", home && "pointer-events-auto")}
            >
              Connect MetaMask
            </button>
          </div>
        </header>
        <div key={pathname} className="senda-rise">
          {booksOn ? (
            <div className="flex gap-1 overflow-x-auto px-3 pt-3 lg:px-4">
              <Link to="/invest" className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold", pathname === "/invest" ? "bg-white text-black" : "bg-white/10 text-white/70")}>
                Trade
              </Link>
              {BOOKS.map((b) => (
                <Link key={b.to} to={b.to} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold", tabOn(pathname, b.to) ? "bg-white text-black" : "bg-white/10 text-white/70")}>
                  {b.label}
                </Link>
              ))}
            </div>
          ) : null}
          {children}
        </div>
        <Onboard />
        <FillReceipt />
      </div>
      <nav className="fixed inset-x-4 z-40 grid grid-cols-5 rounded-[32px] bg-[#2c2c2e]/95 px-1 py-1 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur lg:hidden bottom-[max(0.55rem,env(safe-area-inset-bottom))]">
        {(
          [
            { to: "/", label: "Home", icon: LayoutGrid },
            { to: "/invest", label: "Trade", icon: Hexagon },
            { to: "/wire", label: "Markets", icon: Radar },
            { to: "/vault", label: "Portfolio", icon: Lock },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const on = tabOn(pathname, t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[10px]",
                on ? "bg-black/50 font-medium text-white" : "text-white/55",
              )}
            >
              <Icon className={cn("size-4", on && "text-accent")} />
              {t.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[10px]",
            moreOpen ? "bg-black/50 font-medium text-white" : "text-white/55",
          )}
        >
          <Menu className={cn("size-4", (moreOpen || tabOn(pathname, "/more")) && "text-accent")} strokeWidth={1.75} />
          More
        </button>
      </nav>
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-x-0 top-0 z-40 bg-black/50 lg:hidden bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed inset-x-3 z-50 max-h-[70vh] overflow-y-auto rounded-[28px] bg-[#1c1c1e] p-2 lg:hidden bottom-[calc(5.5rem+env(safe-area-inset-bottom))]">
            <PhoneMore onDone={() => setMoreOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function LiveTape() {
  const [rows, setRows] = useState<TapeRow[]>([]);
  useEffect(() => {
    let live = true;
    const pull = () => {
      jupTape()
        .then((list) => live && setRows(list))
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 30_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);
  const line = rows.filter((r) => r.price && r.price > 0).slice(0, 24);
  return (
    <div className="mb-2 flex items-center gap-3 overflow-hidden">
      <span className="shrink-0 rounded-full bg-[#d7e36a] px-2.5 py-1 text-[11px] font-semibold text-black">LIVE</span>
      <div className="flex min-w-0 gap-4 overflow-x-auto text-[11px] text-white/70">
        {line.length === 0 ? <span>Pulling every coin…</span> : null}
        {line.map((r) => {
          const chg = r.change == null ? null : Math.abs(r.change) <= 2 ? r.change * 100 : r.change;
          const px = r.price ?? 0;
          const shown = px >= 1 ? px.toLocaleString("en-US", { maximumFractionDigits: 2 }) : px.toPrecision(3);
          return (
            <span key={r.id} className="shrink-0 font-mono">
              {r.symbol} ${shown}{" "}
              <span className={chg != null && chg < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]"}>
                {chg == null ? "" : `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MoneyLine({ owner }: { owner: string }) {
  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  useEffect(() => {
    if (!owner) {
      setSol(null);
      setUsdc(null);
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((s) => {
          if (!live) return;
          setSol(s.sol);
          setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);
  const total = (usdc ?? 0);
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <p className="font-mono text-lg tabular-nums">{owner ? (usdc == null ? "…" : `$${total.toFixed(2)}`) : "$0.00"}</p>
      <p className="truncate font-mono text-[11px] text-white/45">
        {sol == null ? "Not connected" : `${sol.toFixed(4)} SOL`}
        {usdc != null ? ` · USDC $${usdc.toFixed(2)}` : ""}
      </p>
    </div>
  );
}

function PhoneMore({ onDone }: { onDone: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups: { name: string; rows: { to: "/wallet" | "/social" | "/cards" | "/work" | "/agents" | "/payments" | "/pre" | "/xstocks" | "/radar" | "/cover" | "/launch" | "/contracts" | "/market" | "/books" | "/docs" | "/more" | "/revolut" | "/phantom" | "/metamask" | "/wallets" | "/wallets/power" | "/solana" | "/make" | "/accounts"; label: string; icon: typeof Wallet }[] }[] = [
    {
      name: "Move",
      rows: [
        { to: "/payments", label: "Send", icon: Wallet },
        { to: "/cards", label: "Pay", icon: CreditCard },
        { to: "/work", label: "Work", icon: SquarePen },
        { to: "/wallet", label: "Swap", icon: ArrowLeftRight },
        { to: "/social", label: "Predict", icon: Gamepad2 },
        { to: "/agents", label: "Agents", icon: Bot },
      ],
    },
    {
      name: "Trade",
      rows: [
        { to: "/pre", label: "PreStocks", icon: Sparkles },
        { to: "/xstocks", label: "xStocks", icon: LineChart },
        { to: "/radar", label: "Spot", icon: Hexagon },
        { to: "/solana", label: "Solana", icon: Hexagon },
        { to: "/make", label: "Make", icon: Store },
      ],
    },
    {
      name: "Hold",
      rows: [
        { to: "/cover", label: "Cover", icon: Shield },
        { to: "/launch", label: "Launch", icon: Zap },
        { to: "/contracts", label: "Contracts", icon: FileText },
        { to: "/market", label: "Protect", icon: Shield },
        { to: "/accounts", label: "Accounts", icon: UserRound },
        { to: "/books", label: "Books", icon: BookOpen },
        { to: "/docs", label: "Docs", icon: FileText },
        { to: "/more", label: "Account", icon: UserRound },
      ],
    },
    {
      name: "Wallets",
      rows: [
        { to: "/wallets", label: "Wallets", icon: Wallet },
        { to: "/wallets/power", label: "Robinhood", icon: Zap },
        { to: "/revolut", label: "Revolut", icon: CreditCard },
        { to: "/phantom", label: "Phantom", icon: Zap },
        { to: "/metamask", label: "MetaMask", icon: Hexagon },
      ],
    },
  ];
  return (
    <div className="pb-2">
      {groups.map((group, i) => (
        <div key={group.name}>
          <p className={cn("px-3 pb-1 text-[10px] tracking-[0.14em] text-subtle uppercase", i === 0 ? "pt-2" : "pt-3")}>{group.name}</p>
          {group.rows.map((row) => {
            const Icon = row.icon;
            const on = tabOn(pathname, row.to);
            return (
              <Link
                key={row.label}
                to={row.to}
                onClick={onDone}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm leading-none",
                  on ? "bg-white/8 font-medium text-fg" : "text-muted hover:bg-white/5 hover:text-fg",
                )}
              >
                <Icon className={cn("size-4 shrink-0", on && "text-accent")} strokeWidth={1.75} />
                {row.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  on,
  quiet,
  compact,
}: {
  to: TabTo;
  label: string;
  icon: typeof LayoutGrid;
  on: boolean;
  quiet?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      title={label}
      className={cn(
        "flex items-center rounded-xl text-[13px] leading-none",
        compact ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2",
        on ? "bg-white/8 font-medium text-fg" : quiet ? "text-subtle hover:bg-white/5 hover:text-fg" : "text-muted hover:bg-white/5 hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0", on ? "text-accent" : "")} strokeWidth={1.75} />
      {compact ? <span className="sr-only">{label}</span> : label}
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
