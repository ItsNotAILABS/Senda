import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BookOpen,
  Bot,
  CreditCard,
  FileText,
  Gamepad2,
  ChartLine,
  Menu,
  Radar,
  Layers,
  LayoutGrid,
  LineChart,
  Lock,
  PanelLeft,
  ScrollText,
  Shield,
  Sparkles,
  Store,
  SquarePen,
  Tv,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Onboard } from "@/components/onboard";
import { DeskAlerts } from "@/components/desk-alerts";
import { WalletPicker } from "@/components/wallet-picker";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readChain, connectPhantom, trustedPhantom } from "@/lib/phantom";
import { loadTape } from "@/lib/jup-tape";
import { connectWallet } from "@/lib/wallets";
import { getEquityBook, listedMarks } from "@/lib/equities";
import { getHouse } from "@/lib/sol-house";
import { quoteRoute, SOL } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { readTapePrefs, TAPE_SECONDS, type TapeFilter, type TapeSpeed } from "@/lib/tape-prefs";
import { sealOpen } from "@/lib/seal";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const DESK = [
  { to: "/", label: "Home", icon: LayoutGrid },
  { to: "/invest", label: "Trade", icon: ChartLine },
  { to: "/solana", label: "Markets", icon: Radar },
  { to: "/radar", label: "Radar", icon: Radar },
  { to: "/wallet", label: "Convert", icon: ArrowLeftRight },
  { to: "/social", label: "Predict", icon: Gamepad2 },
  { to: "/cards", label: "Pay", icon: CreditCard },
  { to: "/work", label: "Work", icon: SquarePen },
  { to: "/agents", label: "AI Agent", icon: Bot },
  { to: "/payments", label: "Send", icon: Wallet },
  { to: "/vault", label: "Portfolio", icon: Lock },
  { to: "/cover", label: "Cover", icon: Shield },
  { to: "/launch", label: "Launch", icon: Zap },
  { to: "/contracts", label: "Contracts", icon: ScrollText },
  { to: "/tv", label: "Crypto TV", icon: Tv },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/docs", label: "Docs", icon: FileText },
  { to: "/more", label: "Account", icon: UserRound },
  { to: "/revolut", label: "Revolut", icon: Wallet },
  { to: "/phantom", label: "Phantom", icon: Wallet },
  { to: "/metamask", label: "MetaMask", icon: Wallet },
] as const;

const EXTRA = [
  { to: "/pre", label: "PreStocks", icon: Sparkles },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/make", label: "Make", icon: Store },
  { to: "/equities", label: "Listed", icon: LineChart },
  { to: "/pools", label: "Pools", icon: Layers },
  { to: "/accounts", label: "Accounts", icon: UserRound },
] as const;

const PHONE = [
  { to: "/", label: "Home", icon: LayoutGrid },
  { to: "/invest", label: "Trade", icon: ChartLine },
  { to: "/solana", label: "Markets", icon: Radar },
  { to: "/vault", label: "Portfolio", icon: Lock },
] as const;

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
  const link = w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const home = pathname === "/";

  useEffect(() => {
    const sync = () => setSealed(!sealOpen());
    sync();
    window.addEventListener("senda-seal", sync);
    return () => window.removeEventListener("senda-seal", sync);
  }, []);

  const linkRef = useRef(linkChain);
  linkRef.current = linkChain;

  useEffect(() => {
    let live = true;
    trustedPhantom()
      .then((addr) => {
        if (!live || !addr || addr === owner) return;
        linkRef.current(addr, "Phantom", "phantom");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [owner]);

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
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-[#07070f] transition-[width] duration-200 lg:flex", rail ? "w-56" : "w-[68px]")}>
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
        <nav className={cn("flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3", rail ? "px-2" : "px-2")}>
          {DESK.map((t) => (
            <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} compact={!rail} />
          ))}
          <p className={cn("mt-3 px-2.5 pt-3 text-[10px] tracking-[0.16em] text-subtle uppercase", rail ? "border-t border-white/8" : "sr-only")}>More</p>
          {EXTRA.map((t) => (
            <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} quiet compact={!rail} />
          ))}
        </nav>
        <div className={cn("border-t border-border py-3", rail ? "px-2" : "px-2")}>
          {sealed ? (
            <button
              type="button"
              onClick={() => {
                void connectPhantom()
                  .then((addr) => {
                    const linked = linkChain(addr, "Phantom", "phantom");
                    if (!linked.ok) toast.error(linked.error || "The wallet did not stay.");
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "The desk stayed sealed."));
              }}
              title="Open with wallet"
              className={cn("mb-2 min-h-9 rounded-full bg-accent font-semibold text-accent-fg", rail ? "w-full px-3 text-[12px]" : "mx-auto grid size-9 place-items-center")}
            >
              {rail ? "Open with wallet" : <Lock className="size-3.5" />}
            </button>
          ) : rail ? (
            <p className="mb-2 px-1 text-[11px] text-subtle">Open on this browser.</p>
          ) : null}
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
          <div className={cn("flex items-center gap-2", home && "justify-end")}>
            <form
              className={cn("min-w-0", home ? "pointer-events-auto w-12" : "hidden w-full flex-1 lg:block")}
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
                else if (key === "tv" || key === "crypto tv" || key === "crypto") void navigate({ to: "/tv" });
                else if (key === "loans" || key === "loan" || key === "borrow") void navigate({ to: "/invest", search: { desk: "loans" } });
                else if (key === "perps" || key === "perp") void navigate({ to: "/invest", search: { desk: "perps" } });
                else if (key === "xstocks" || key === "xstock" || key === "stocks") void navigate({ to: "/invest", search: { desk: "xstock" } });
                else if (key === "metals" || key === "fx" || key === "gold") void navigate({ to: "/invest", search: { desk: "world" } });
                else if (key === "commodities" || key === "oil") void navigate({ to: "/invest", search: { desk: "comms" } });
                else if (key === "options" || key === "calls") void navigate({ to: "/invest", search: { desk: "options" } });
                else if (key === "futures") void navigate({ to: "/invest", search: { desk: "futures" } });
                else if (key === "bridge") void navigate({ to: "/invest", search: { desk: "bridge" } });
                else if (key === "coins") void navigate({ to: "/invest", search: { desk: "tape" } });
                else if (key === "prestocks" || key === "pre") void navigate({ to: "/invest", search: { desk: "pre" } });
                else if (key === "home") void navigate({ to: "/" });
                else void navigate({ to: "/pre", search: { q: key } });
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={home ? "Search" : "Search companies, tickers, or anything…"}
                className={cn("min-h-10 w-full rounded-full border border-white/10 bg-[#1c1c1e] text-[13px] outline-none", home ? "px-3" : "px-4")}
              />
            </form>
            <span className={cn(home && "pointer-events-auto")}>
              <DeskAlerts />
            </span>
            <div className={cn("relative flex items-center gap-2", home && "pointer-events-auto")}>
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
                        const kept = linkChain(addr, "Phantom", "phantom");
                        if (!kept.ok && kept.error !== "Already linked.") toast.error(kept.error || "Phantom did not stay.");
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Phantom did not open."));
                  }}
                  className="inline-flex min-h-10 items-center rounded-full bg-[#d7e36a] px-4 text-sm font-semibold text-black"
                >
                  Connect Phantom
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  void connectWallet("metamask")
                    .then((got) => {
                      const kept = linkChain(got.address, got.label, "evm");
                      if (!kept.ok && kept.error !== "Already linked.") toast.error(kept.error || "MetaMask did not stay.");
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : "MetaMask did not open."));
                }}
                className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm"
              >
                Connect MetaMask
              </button>
              {connectOpen && !link ? (
                <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-border bg-surface p-3 shadow-border">
                  <WalletPicker />
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div key={pathname} className="senda-rise">
          <div className="hidden md:block">
            <MoneyStrip owner={owner} cash={w.balances.USD || 0} />
          </div>
          <div className="md:hidden">
            <MoneyStrip owner={owner} cash={w.balances.USD || 0} edge />
          </div>
          {children}
        </div>
        <Onboard />
      </div>
      <nav className="fixed inset-x-4 z-40 grid grid-cols-5 rounded-[32px] bg-[#2c2c2e]/95 px-1 py-1 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur lg:hidden bottom-[max(0.55rem,env(safe-area-inset-bottom))]">
        {PHONE.map((t) => {
          const Icon = t.icon;
          const on = tabOn(pathname, t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              title={t.label}
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[10px]",
                on ? "bg-black/50 font-medium text-white" : "text-white/55",
              )}
            >
              <Icon className={cn("size-4 shrink-0", on && "text-accent")} />
              {t.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[10px]",
            moreOpen ? "bg-black/50 font-medium text-white" : "text-white/55",
          )}
        >
          <Menu className="size-4 shrink-0" />
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
            <MoreSheet path={pathname} onDone={() => setMoreOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function MoreSheet({ path, onDone }: { path: string; onDone: () => void }) {
  const group = (
    title: string,
    first: boolean,
    rows: { to: "/" | "/wallet" | "/social" | "/cards" | "/work" | "/agents" | "/payments" | "/pre" | "/xstocks" | "/radar" | "/cover" | "/launch" | "/contracts" | "/tv" | "/books" | "/docs" | "/more" | "/revolut" | "/robinhood" | "/phantom" | "/metamask" | "/wallets" | "/pools" | "/equities" | "/make" | "/accounts"; label: string; hint?: string; icon: typeof LayoutGrid }[],
  ) => (
    <div>
      <p className={cn("px-3 pb-1 text-[10px] tracking-[0.14em] text-white/40 uppercase", first ? "pt-2" : "pt-3")}>{title}</p>
      <ul>
        {rows.map((row) => {
          const Icon = row.icon;
          const on = path === row.to || path.startsWith(`${row.to}/`);
          return (
            <li key={row.label}>
              <Link to={row.to} onClick={onDone} className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm", on && "bg-white/10")}>
                <Icon className={cn("size-4 shrink-0", on && "text-[#d7e36a]")} strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block font-medium">{row.label}</span>
                  {row.hint ? <span className={cn("block truncate text-[11px]", on ? "text-white/50" : "text-white/35")}>{row.hint}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <div>
      {group("Move", true, [
        { to: "/payments", label: "Send", hint: "Send USDC to someone", icon: Wallet },
        { to: "/cards", label: "Pay", hint: "The card on this computer, then USDC", icon: CreditCard },
        { to: "/work", label: "Work", hint: "Post it. Pay the wallet that did it", icon: SquarePen },
        { to: "/wallet", label: "Convert", hint: "Swap what you already hold", icon: ArrowLeftRight },
        { to: "/social", label: "Predict", hint: "Above or below the print", icon: Gamepad2 },
        { to: "/agents", label: "Agents", hint: "Make one, or hire a trader", icon: Bot },
      ])}
      {group("Trade", false, [
        { to: "/pre", label: "PreStocks", hint: "Buy a pre-IPO name", icon: LineChart },
        { to: "/xstocks", label: "xStocks", hint: "Listed shares in the wallet", icon: LineChart },
        { to: "/equities", label: "Listed", hint: "The same xStock book", icon: LineChart },
        { to: "/radar", label: "Spot", hint: "Last versus the mark", icon: LineChart },
        { to: "/pools", label: "Pools", hint: "Shared books you can join", icon: Layers },
        { to: "/make", label: "Make", hint: "Shop with the cash", icon: Store },
      ])}
      {group("Hold", false, [
        { to: "/wallets", label: "Wallets", hint: "The wallets you already have", icon: Wallet },
        { to: "/accounts", label: "Accounts", hint: "A pocket for each currency", icon: UserRound },
        { to: "/cover", label: "Cover", hint: "Premium against a drop", icon: Shield },
        { to: "/launch", label: "Launch", hint: "Names that already trade", icon: Zap },
        { to: "/contracts", label: "Contracts", hint: "What you already signed", icon: ScrollText },
        { to: "/tv", label: "Crypto TV", hint: "The live book", icon: Tv },
        { to: "/books", label: "Books", hint: "The shared desks", icon: BookOpen },
        { to: "/docs", label: "Docs", hint: "How a product settles", icon: FileText },
        { to: "/more", label: "Account", hint: "The address and the caps", icon: UserRound },
      ])}
      {group("Wallets", false, [
        { to: "/revolut", label: "Revolut", hint: "Receive, or sign a send to their address", icon: CreditCard },
        { to: "/robinhood", label: "Robinhood", hint: "Buying power in as USDC or SOL", icon: Wallet },
        { to: "/phantom", label: "Phantom", hint: "The Solana account that signs", icon: Wallet },
        { to: "/metamask", label: "MetaMask", hint: "Base ETH and USDC", icon: Wallet },
      ])}
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
  to: "/" | "/pre" | "/contracts" | "/invest" | "/wallet" | "/vault" | "/social" | "/agents" | "/work" | "/payments" | "/cards" | "/make" | "/cover" | "/solana" | "/equities" | "/pools" | "/books" | "/tv" | "/docs" | "/more" | "/wallets" | "/market" | "/xstocks" | "/radar" | "/launch" | "/revolut" | "/robinhood" | "/phantom" | "/metamask" | "/accounts";
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
        "relative flex items-center rounded-xl text-[13px] leading-none",
        compact ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2",
        on ? "bg-white/[0.07] font-medium text-fg" : quiet ? "text-subtle hover:bg-white/5 hover:text-fg" : "text-muted hover:bg-white/5 hover:text-fg",
      )}
    >
      <span className={cn("absolute top-1/2 left-0 hidden h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent", on && !compact && "block")} />
      <Icon className={cn("size-4 shrink-0", on ? "text-accent" : "")} strokeWidth={1.75} />
      {compact ? <span className="sr-only">{label}</span> : label}
    </Link>
  );
}

function LiveTape() {
  const [rows, setRows] = useState<{ symbol: string; price: number; change: number }[]>([]);
  const [speed, setSpeed] = useState<TapeSpeed>("slow");
  const [filter, setFilter] = useState<TapeFilter>("all");
  useEffect(() => {
    const pullPrefs = () => {
      const prefs = readTapePrefs();
      setSpeed(prefs.speed);
      setFilter(prefs.filter);
    };
    pullPrefs();
    window.addEventListener("senda-tape", pullPrefs);
    return () => window.removeEventListener("senda-tape", pullPrefs);
  }, []);
  useEffect(() => {
    let live = true;
    const pull = () => {
      loadTape()
        .then((list) => {
          if (!live) return;
          setRows(list.slice(0, 24).map((r) => ({ symbol: r.symbol, price: r.price, change: r.change })));
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 30_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);
  const shown = rows.filter((r) => {
    const ch = r.change;
    if (filter === "up") return ch > 0;
    if (filter === "down") return ch < 0;
    return true;
  });
  const loop = shown.length ? [...shown, ...shown] : [];
  const label = filter === "up" ? "UP" : filter === "down" ? "DOWN" : "ALL";
  return (
    <div className="mb-2 flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-black/35 py-1 pr-1 pl-1">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/80">
        <span className="size-1.5 rounded-full bg-[#c6f56a]" />
        {label}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        {loop.length === 0 ? (
          <p className="px-2 text-[12px] text-white/40">{rows.length === 0 ? "Waiting on Jupiter." : "Nothing in this filter."}</p>
        ) : (
          <div className="tape-scroll flex w-max items-center gap-1.5" style={{ animationDuration: `${TAPE_SECONDS[speed]}s` }}>
            {loop.map((r, i) => {
              const ch = r.change;
              const px = r.price >= 1 ? `$${r.price.toFixed(2)}` : `$${r.price.toPrecision(3)}`;
              return (
                <span key={`${r.symbol}-${i}`} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] whitespace-nowrap">
                  <span className="font-semibold">{r.symbol}</span>
                  <span className="font-mono text-white/70">{px}</span>
                  <span className={ch < 0 ? "font-mono text-[#ff5d73]" : "font-mono text-[#c6f56a]"}>
                    {ch >= 0 ? "+" : ""}
                    {ch.toFixed(1)}%
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyStrip({ owner, cash, edge }: { owner: string; cash: number; edge?: boolean }) {
  const [sol, setSol] = useState(0);
  const [solPx, setSolPx] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [companies, setCompanies] = useState(0);
  const [crypto, setCrypto] = useState(0);
  const [listed, setListed] = useState(0);
  const [posted, setPosted] = useState(0);
  const [bare, setBare] = useState<{ symbol: string; ui: number }[]>([]);
  useEffect(() => {
    let live = true;
    const pull = () => {
      Promise.all([
        owner ? readChain(owner).catch(() => null) : Promise.resolve(null),
        getHouse().catch(() => []),
        quoteRoute({ inputMint: SOL, outputMint: USDC, amountRaw: 1_000_000_000, outDecimals: 6 }).catch(() => null),
        getEquityBook().catch(() => null),
      ]).then(async ([chain, house, px, equities]) => {
        if (!live) return;
        const price = px?.outUi ?? 0;
        setSolPx(price);
        setSol(chain?.sol ?? 0);
        setUsdc(chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        const prestock = new Map(house.filter((h) => h.venue === "prestocks" && h.last > 0).map((h) => [h.mint, h.last]));
        const listedMint = new Set((equities?.stocks ?? []).map((s) => s.mint));
        let co = 0;
        const extra: string[] = [];
        for (const token of chain?.tokens ?? []) {
          const last = prestock.get(token.mint);
          if (last) co += token.ui * last;
          else if (token.symbol !== "USDC" && listedMint.has(token.mint)) extra.push(token.mint);
          else if (token.symbol !== "USDC" && !listedMint.has(token.mint)) extra.push(token.mint);
        }
        setCompanies(co);
        const marks = extra.length ? await listedMarks({ data: extra.slice(0, 30) }).catch(() => ({} as Record<string, number>)) : {};
        if (!live) return;
        let listedUsd = 0;
        let cryptoUsd = 0;
        for (const token of chain?.tokens ?? []) {
          if (token.symbol === "USDC" || prestock.has(token.mint)) continue;
          const pxTok = marks[token.mint] || 0;
          if (!(pxTok > 0)) continue;
          if (listedMint.has(token.mint)) listedUsd += token.ui * pxTok;
          else cryptoUsd += token.ui * pxTok;
        }
        setListed(listedUsd);
        setCrypto(cryptoUsd);
        const missed: { symbol: string; ui: number }[] = [];
        for (const token of chain?.tokens ?? []) {
          if (!(token.ui > 0) || token.symbol === "USDC" || prestock.has(token.mint)) continue;
          if ((marks[token.mint] || 0) > 0) continue;
          missed.push({ symbol: token.symbol, ui: token.ui });
        }
        setBare(missed);
        try {
          const rows = JSON.parse(window.localStorage.getItem("senda.desk.contracts.v1") || "[]") as { usd?: number }[];
          setPosted(Array.isArray(rows) ? rows.reduce((s, r) => s + (Number(r.usd) || 0), 0) : 0);
        } catch {
          setPosted(0);
        }
      });
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    window.addEventListener("senda-chain", pull);
    return () => {
      live = false;
      window.clearInterval(id);
      window.removeEventListener("senda-chain", pull);
    };
  }, [owner]);
  const solDollars = sol * solPx;
  const total = usdc + solDollars + companies + crypto + listed + cash + posted;
  const money = (n: number) => (n > 0 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}` : "—");
  const cell = (k: string, v: string) => (
    <span className="shrink-0 px-3 py-2">
      <span className="block text-[10px] tracking-wide text-subtle uppercase">{k}</span>
      <span className="font-mono text-sm tabular-nums">{v}</span>
    </span>
  );
  if (edge) {
    return (
      <div className="flex items-baseline justify-between gap-3 px-1 py-1">
        <p className="font-mono text-lg tabular-nums">${total.toFixed(2)}</p>
        <p className="truncate font-mono text-[11px] text-white/45">
          {owner ? `${sol.toFixed(4)} SOL${solDollars > 0 ? ` · $${solDollars.toFixed(2)}` : ""} · USDC $${usdc.toFixed(2)}` : "Not connected"}
        </p>
      </div>
    );
  }
  return (
    <div className={cn("flex items-stretch overflow-x-auto bg-[#10131c]", edge ? "" : "mx-3 mt-3 rounded-2xl border border-white/10")}>
      <Link to="/vault" className="shrink-0 px-4 py-2">
        <span className="block text-[10px] tracking-wide text-subtle uppercase">Your money</span>
        <span className="font-mono text-lg tabular-nums">${Math.round(total).toLocaleString("en-US")}</span>
      </Link>
      {cell("SOL", sol > 0 ? (solDollars > 0 ? money(solDollars) : sol.toFixed(3)) : "—")}
      {cell("USDC", money(usdc))}
      {cell("Cash", money(cash))}
      {cell("Companies", money(companies))}
      {cell("Crypto", money(crypto))}
      {cell("Listed", money(listed))}
      {cell("In a pot", money(posted))}
      {bare.slice(0, 4).map((row) => (
        <span key={row.symbol} className="shrink-0 px-3 py-2">
          <span className="block text-[10px] tracking-wide text-subtle uppercase">{row.symbol}</span>
          <span className="font-mono text-sm tabular-nums">{row.ui >= 1 ? row.ui.toFixed(2) : row.ui.toFixed(4)}</span>
        </span>
      ))}
      {bare.length > 4 ? cell("More", String(bare.length - 4)) : null}
    </div>
  );
}

function ChainChip({ owner }: { owner: string }) {
  const [lines, setLines] = useState<{ symbol: string; ui: number }[]>([]);
  useEffect(() => {
    if (!owner) {
      setLines([]);
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((s) => {
          if (!live) return;
          const rows = s.sol > 0 ? [{ symbol: "SOL", ui: s.sol }] : [];
          for (const token of s.tokens) {
            if (token.ui > 0) rows.push({ symbol: token.symbol, ui: token.ui });
          }
          setLines(rows);
        })
        .catch(() => live && setLines([]));
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    window.addEventListener("senda-chain", pull);
    return () => {
      live = false;
      window.clearInterval(id);
      window.removeEventListener("senda-chain", pull);
    };
  }, [owner]);
  const shown = lines.slice(0, 4).map((row) => `${row.symbol} ${row.ui >= 1 ? row.ui.toFixed(2) : row.ui.toFixed(4)}`).join(" · ");
  return (
    <Link to="/vault" className="block max-w-[14rem] rounded-lg bg-bg px-2.5 py-1.5 hover:bg-elevated">
      <p className="truncate font-mono text-xs text-fg">{owner ? (lines.length ? shown : "…") : "Your money"}</p>
      <p className="font-mono text-[10px] text-subtle">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}${lines.length > 4 ? ` · +${lines.length - 4}` : ""}` : "Not connected"}</p>
    </Link>
  );
}
