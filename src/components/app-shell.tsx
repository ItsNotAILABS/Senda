import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Aperture,
  Banknote,
  Boxes,
  ArrowLeftRight,
  BookOpen,
  Bot,
  CreditCard,
  FileText,
  Gamepad2,
  Hexagon,
  LayoutGrid,
  LineChart,
  ListOrdered,
  Lock,
  Menu,
  PanelLeft,
  Radar,
  ScrollText,
  Shield,
  Sparkles,
  SquarePen,
  Tv,
  UserRound,
  Wallet,
  Zap,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { FillPaint } from "@/components/fill-paint";
import { Onboard } from "@/components/onboard";
import { CoinTicker } from "@/components/coin-ticker";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readChain, connectPhantom, waitForInjected, pickOwner, liveSolAddress, invalidateChain } from "@/lib/phantom";
import { humanWalletError, injectedWallet, insideWalletApp, isPhoneBrowser, openInWallet, takeBuyAgain } from "@/lib/mobile-wallet";
import { connectWallet } from "@/lib/wallets";
import { loadClearing } from "@/lib/clearing";
import { buildPicture, quoteHeld, type Picture } from "@/lib/money-picture";
import { loadPulse } from "@/lib/universe";
import { onTrades } from "@/lib/trade-log";
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
  { to: "/orders", label: "Orders", icon: ListOrdered },
  { to: "/launch", label: "Launch", icon: Zap },
  { to: "/contracts", label: "Contracts", icon: ScrollText },
  { to: "/market", label: "Crypto TV", icon: Tv },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/docs", label: "Docs", icon: FileText },
  { to: "/more", label: "Account", icon: UserRound },
] as const;

const ACCOUNTS = [
  { to: "/revolut", label: "Revolut", icon: Banknote },
  { to: "/phantom", label: "Phantom", icon: Aperture },
  { to: "/metamask", label: "MetaMask", icon: Boxes },
  { to: "/backpack", label: "Backpack", icon: Wallet },
] as const;

const SEARCH: { label: string; where: string; keys: string; to: "/" | "/invest" | "/wire" | "/wallet" | "/payments" | "/pre" | "/vault" | "/social" | "/agents" | "/work" | "/cards" | "/global"; search?: Record<string, string | number> }[] = [
  { label: "Screener", where: "Trade", keys: "screener smart route cheaper", to: "/invest", search: { desk: "smart" } },
  { label: "Shares", where: "Trade", keys: "backpack securities aapl nvda", to: "/invest", search: { desk: "term" } },
  { label: "Quotes", where: "Trade", keys: "spot quotes", to: "/invest", search: { desk: "spot" } },
  { label: "Global", where: "Account", keys: "global bank pix spei esim wise", to: "/global" },
  { label: "FX and metals", where: "Trade", keys: "fx forex gold silver metals", to: "/invest", search: { desk: "world" } },
  { label: "Commodities", where: "Trade", keys: "oil commodities energy", to: "/invest", search: { desk: "comms" } },
  { label: "Options", where: "Trade", keys: "calls puts options", to: "/invest", search: { desk: "options" } },
  { label: "Perps", where: "Trade", keys: "perpetual perps", to: "/invest", search: { desk: "perps" } },
  { label: "PreStocks", where: "Trade", keys: "pre ipo prestocks", to: "/invest", search: { desk: "pre" } },
  { label: "xStocks", where: "Trade", keys: "stocks etf spy", to: "/invest", search: { desk: "xstock" } },
  { label: "Futures", where: "Trade", keys: "futures fdv", to: "/invest", search: { desk: "futures" } },
  { label: "Loans", where: "Trade", keys: "borrow kamino aave loans", to: "/invest", search: { desk: "loans" } },
  { label: "Bridge", where: "Trade", keys: "bridge swap chains monad optimism avalanche bnb", to: "/invest", search: { desk: "bridge" } },
  { label: "Hedge", where: "Trade", keys: "hedge short", to: "/invest", search: { desk: "hedge" } },
  { label: "Cover", where: "Trade", keys: "cover insure", to: "/invest", search: { desk: "cover" } },
  { label: "Coins", where: "Trade", keys: "coins jupiter", to: "/invest", search: { desk: "tape" } },
  { label: "Markets", where: "Markets", keys: "markets wire news", to: "/wire" },
  { label: "Swap", where: "Wallet", keys: "swap convert usdc", to: "/wallet" },
  { label: "Send", where: "Pay", keys: "send pay link", to: "/payments" },
  { label: "Portfolio", where: "Portfolio", keys: "portfolio vault balances", to: "/vault" },
];

function tabOn(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [booksOpen, setBooksOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);
  const onBook = pathname === "/invest" || BOOKS.some((b) => tabOn(pathname, b.to));
  useEffect(() => {
    if (onBook) setBooksOpen(true);
  }, [onBook]);
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const { w, linkChain } = useWallet();
  const [liveOwner, setLiveOwner] = useState("");
  useEffect(() => {
    const pull = () => setLiveOwner(liveSolAddress());
    pull();
    const id = window.setInterval(pull, 2000);
    return () => window.clearInterval(id);
  }, []);
  const owner = liveOwner || pickOwner(w.links);
  const [q, setQ] = useState("");
  const [rail, setRail] = useState(true);
  const [phone, setPhone] = useState(false);
  const [signer, setSigner] = useState(false);
  const phantomLink = w.links.find((l) => l.kind === "phantom");
  const maskLink = w.links.find((l) => l.kind === "evm");
  const home = pathname === "/";

  useEffect(() => {
    setPhone(isPhoneBrowser());
    let live = true;
    const look = () => {
      if (!live) return;
      const inside = insideWalletApp();
      setSigner(inside || injectedWallet());
    };
    look();
    const hint = insideWalletApp() ? takeBuyAgain() : null;
    if (hint) toast(hint);
    const id = window.setInterval(look, 400);
    const stop = window.setTimeout(() => window.clearInterval(id), 12000);
    return () => {
      live = false;
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      const injected = await waitForInjected(isPhoneBrowser() ? 8000 : 1500);
      if (!live || !injected?.connect) return;
      setSigner(true);
      try {
        const res = await injected.connect({ onlyIfTrusted: true });
        const addr = res?.publicKey?.toString() || injected.publicKey?.toString();
        if (!addr || !live) return;
        const linked = linkChain(addr, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") return;
        invalidateChain(addr);
      } catch {
        /* A trusted wallet reconnects quietly. A first connect still needs a tap. No signature here. */
      }
    })();
    return () => {
      live = false;
    };
    // Once per open. linkChain changes identity every render, and a signature must not follow it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem("rail.open") === "0") setRail(false);
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
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-[#050508] transition-[width] duration-200 lg:flex", rail ? "w-56" : "w-[68px]")}>
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
        <nav className={cn("flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto", rail ? "px-2" : "px-2")}>
          {PRIMARY.map((t) => (
            <div key={t.to}>
              <div className="flex items-center">
                <div className="min-w-0 flex-1">
                  <NavLink to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to) || (t.to === "/invest" && onBook)} compact={!rail} />
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
            {ACCOUNTS.map((t) => (
              <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} quiet compact={!rail} />
            ))}
          </div>
        </nav>
        <div className={cn("border-t border-border py-3", rail ? "px-2" : "px-2")}>
          <Link
            to="/safe"
            title="Vault"
            className={cn("mb-2 min-h-9 rounded-full bg-accent font-semibold text-accent-fg", rail ? "flex w-full items-center justify-center px-3 text-[12px]" : "mx-auto grid size-9 place-items-center")}
          >
            {rail ? "Vault" : <Lock className="size-3.5" />}
          </Link>
          {rail ? <RailMoney owner={owner} cash={w.balances.USD || 0} /> : null}
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
      <div className="senda-stage min-w-0 flex-1 pb-24 lg:pb-0">
        <div className="sticky top-0 z-30">
        <CoinTicker />
        <ChainChip owner={owner} cash={w.balances.USD || 0} />
        <header className={cn("bg-[#050508]/90 px-4 py-3 backdrop-blur", home && "pointer-events-none")}>
          <div className="flex items-center gap-3">
            <form
              className={cn("relative min-w-0 w-full flex-1", home && "pointer-events-auto")}
              onSubmit={(e) => {
                e.preventDefault();
                const key = q.trim().toLowerCase();
                setQ("");
                if (!key) return;
                if (key === "send") void navigate({ to: "/payments" });
                else if (key === "add") void navigate({ to: "/payments", search: { act: "add" } });
                else if (key === "card" || key === "cards" || key === "shop") void navigate({ to: "/cards", search: { spend: 0 } });
                else if (key === "wallets") void navigate({ to: "/wallet", search: { lane: "wallets" } });
                else if (key === "stake") void navigate({ to: "/wallet", search: { lane: "stake" } });
                else if (key === "exchange" || key === "convert" || key === "wallet" || key === "swap") void navigate({ to: "/wallet" });
                else if (key === "vault") void navigate({ to: "/safe" });
                else if (key === "portfolio") void navigate({ to: "/vault" });
                else if (key === "revolut") void navigate({ to: "/revolut" });
                else if (key === "phantom") void navigate({ to: "/phantom" });
                else if (key === "metamask" || key === "mask") void navigate({ to: "/metamask" });
                else if (key === "contracts" || key === "contract") void navigate({ to: "/contracts" });
                else if (key === "play") void navigate({ to: "/social" });
                else if (key === "agent" || key === "agents") void navigate({ to: "/agents" });
                else if (key === "work" || key === "make") void navigate({ to: "/work" });
                else if (key === "trade" || key === "solana") void navigate({ to: "/invest", search: key === "solana" ? { lane: "solana" } : {} });
                else if (key === "markets" || key === "wire") void navigate({ to: "/wire" });
                else if (key === "tv" || key === "market") void navigate({ to: "/market" });
                else if (key === "spot" || key === "tape") void navigate({ to: "/radar" });
                else if (key === "radar") void navigate({ to: "/wire" });
                else if (key === "books") void navigate({ to: "/books" });
                else if (key === "account" || key === "more") void navigate({ to: "/more" });
                else if (key === "docs" || key === "doc") void navigate({ to: "/docs" });
                else if (key === "home") void navigate({ to: "/" });
                else if (key === "pre" || key === "prestocks") void navigate({ to: "/pre" });
                else void navigate({ to: "/pre", search: { q: key } });
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search markets, names, products"
                className="min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none"
              />
              {q.trim() ? (
                <ul className="absolute inset-x-0 top-12 z-50 max-h-72 overflow-y-auto rounded-2xl bg-[#1c1c1e] py-1 shadow-2xl">
                  {SEARCH.filter((row) => `${row.label} ${row.keys}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8).map((row) => (
                    <li key={row.label}>
                      <button
                        type="button"
                        onClick={() => {
                          setQ("");
                          void navigate({ to: row.to, search: row.search as never });
                        }}
                        className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left"
                      >
                        <span className="text-sm font-semibold">{row.label}</span>
                        <span className="text-[11px] text-white/40">{row.where}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button type="submit" className="w-full px-4 py-2 text-left text-sm text-white/70">
                      Names matching “{q.trim()}”
                    </button>
                  </li>
                </ul>
              ) : null}
            </form>
            {home ? null : (
            <span className="grid size-10 place-items-center rounded-full border border-white/10 text-muted">
              <Bell className="size-4" />
            </span>
            )}
            <div className={cn("relative flex items-center gap-2", home && "pointer-events-auto")}>
              <button
                type="button"
                onClick={() => {
                  if (phone && !signer) {
                    openInWallet("phantom");
                    return;
                  }
                  void connectPhantom()
                    .then((addr) => {
                      invalidateChain(addr);
                      const linked = linkChain(addr, "Phantom", "phantom");
                      if (!linked.ok && linked.error !== "Already linked.") toast.error(linked.error || "Phantom did not stay.");
                    })
                    .catch((e) => toast.error(humanWalletError(e instanceof Error ? e.message : "Phantom did not connect.")));
                }}
                className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
              >
                {phantomLink ? `Phantom ${phantomLink.address.slice(0, 4)}…` : phone && !signer ? "Open Phantom" : "Connect Phantom"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void connectWallet("metamask")
                    .then((got) => {
                      const linked = linkChain(got.address, "MetaMask", "evm");
                      if (!linked.ok && linked.error !== "Already linked.") toast.error(linked.error || "MetaMask did not stay.");
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : "MetaMask did not connect."));
                }}
                className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold"
              >
                {maskLink ? `MetaMask ${maskLink.address.slice(0, 6)}…` : "Connect MetaMask"}
              </button>
            </div>
          </div>
        </header>
        </div>
        <div key={pathname} className="senda-rise pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {onBook ? <BookStrip pathname={pathname} /> : null}
          {children}
        </div>
        <Onboard />
      </div>
      {moreOpen ? (
        <>
          <button type="button" aria-label="Close" className="fixed inset-x-0 top-0 z-40 bg-black/50 lg:hidden bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" onClick={() => setMoreOpen(false)} />
          <div className="fixed inset-x-3 z-50 max-h-[70vh] overflow-y-auto rounded-[28px] bg-[#1c1c1e] p-2 lg:hidden bottom-[calc(5.5rem+env(safe-area-inset-bottom))]">
            <p className="px-3 pt-2 pb-1 text-[10px] tracking-[0.14em] text-subtle uppercase">Move</p>
            {PRIMARY.filter((t) => !["/", "/invest", "/wire", "/vault"].includes(t.to)).map((t) => (
              <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} close={() => setMoreOpen(false)} />
            ))}
            <p className="px-3 pt-3 pb-1 text-[10px] tracking-[0.14em] text-subtle uppercase">Markets</p>
            {BOOKS.map((t) => (
              <NavLink key={t.to} to={t.to} label={t.label} icon={LineChart} on={tabOn(pathname, t.to)} close={() => setMoreOpen(false)} />
            ))}
            <p className="px-3 pt-3 pb-1 text-[10px] tracking-[0.14em] text-subtle uppercase">More</p>
            {MORE.map((t) => (
              <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} close={() => setMoreOpen(false)} />
            ))}
            <p className="px-3 pt-3 pb-1 text-[10px] tracking-[0.14em] text-subtle uppercase">Wallets</p>
            {ACCOUNTS.map((t) => (
              <NavLink key={t.to} to={t.to} label={t.label} icon={t.icon} on={tabOn(pathname, t.to)} close={() => setMoreOpen(false)} />
            ))}
          </div>
        </>
      ) : null}
      <nav className="fixed inset-x-4 z-40 grid grid-cols-5 rounded-[32px] bg-[#2c2c2e]/95 px-1 py-1 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur lg:hidden bottom-[max(0.55rem,env(safe-area-inset-bottom))]">
        <NavLink to="/" label="Home" icon={LayoutGrid} on={tabOn(pathname, "/")} dock />
        <NavLink to="/invest" label="Trade" icon={LineChart} on={tabOn(pathname, "/invest")} dock />
        <NavLink to="/wire" label="Markets" icon={Radar} on={tabOn(pathname, "/wire")} dock />
        <NavLink to="/vault" label="Portfolio" icon={Wallet} on={tabOn(pathname, "/vault")} dock />
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn("flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[10px]", moreOpen || tabOn(pathname, "/more") ? "bg-black/50 font-medium text-white" : "text-white/55")}
        >
          <Menu className={cn("size-4", moreOpen || tabOn(pathname, "/more") ? "text-accent" : "")} strokeWidth={1.75} />
          More
        </button>
      </nav>
      <FillPaint />
    </div>
  );
}

function BookStrip({ pathname }: { pathname: string }) {
  const tabs = [{ to: "/invest" as const, label: "Trade" }, ...BOOKS];
  return (
    <div className="flex gap-1 overflow-x-auto px-3 pt-3 lg:px-4">
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={cn(
            "shrink-0 rounded-full px-3 py-2 text-xs font-semibold",
            tabOn(pathname, tab.to) && tab.to !== "/invest" || (tab.to === "/invest" && pathname === "/invest")
              ? "bg-white text-black"
              : "bg-white/10 text-white/70",
          )}
        >
          {tab.label}
        </Link>
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
  dock,
  close,
}: {
  to: "/" | "/pre" | "/xstocks" | "/contracts" | "/invest" | "/wallet" | "/wallets" | "/vault" | "/social" | "/agents" | "/work" | "/payments" | "/cards" | "/make" | "/cover" | "/orders" | "/launch" | "/solana" | "/swap" | "/market" | "/radar" | "/wire" | "/books" | "/docs" | "/more" | "/revolut" | "/phantom" | "/metamask" | "/backpack";
  label: string;
  icon: typeof LayoutGrid;
  on: boolean;
  quiet?: boolean;
  compact?: boolean;
  dock?: boolean;
  close?: () => void;
}) {
  return (
    <Link
      to={to}
      search={to === "/cards" ? { spend: 0 } : undefined}
      title={label}
      onClick={close}
      className={cn(
        "flex items-center rounded-xl text-sm leading-none",
        dock ? "min-h-14 w-full flex-col justify-center gap-0.5 rounded-full px-1 py-1 text-[10px]" : compact ? "justify-center px-0 py-1.5" : "gap-2.5 px-2.5 py-1.5",
        on && dock ? "bg-black/50 font-medium text-white" : on ? "bg-white/8 font-medium text-fg" : quiet ? "text-subtle hover:bg-white/5 hover:text-fg" : dock ? "text-white/55" : "text-muted hover:bg-white/5 hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0", on ? "text-accent" : "")} strokeWidth={1.75} />
      {compact && !dock ? <span className="sr-only">{label}</span> : label}
    </Link>
  );
}

function RailMoney({ owner, cash }: { owner: string; cash: number }) {
  const [pic, setPic] = useState<Picture | null>(null);
  useEffect(() => {
    let live = true;
    const pull = () => {
      const paint = (chain: { sol: number; tokens: Array<{ mint: string; ui: number; symbol?: string }> }, tape: Parameters<typeof buildPicture>[0]["tape"], house: Parameters<typeof buildPicture>[0]["house"]) => {
        if (!live) return;
        setPic(buildPicture({
          owner,
          sol: chain.sol,
          tokens: chain.tokens.map((t) => ({ mint: t.mint, ui: t.ui, symbol: t.symbol })),
          tape,
          cash,
          house,
        }));
      };
      const chainP = owner
        ? readChain(owner)
        : Promise.resolve({ sol: 0, tokens: [] as Array<{ mint: string; ui: number; symbol: string }> });
      void chainP.then((chain) => paint(chain, [], null)).catch(() => undefined);
      void Promise.all([
        chainP,
        loadPulse().catch(() => ({ rows: [] })),
        loadClearing().catch(() => null),
      ]).then(async ([chain, pulse, house]) => {
        paint(chain, pulse.rows, house);
        const tape = await quoteHeld(chain.tokens.map((t) => t.mint), pulse.rows).catch(() => pulse.rows);
        paint(chain, tape, house);
      }).catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    const stop = onTrades(pull);
    return () => {
      live = false;
      window.clearInterval(id);
      stop();
    };
  }, [owner, cash]);
  const row = pic || { total: 0, sol: 0, usdc: 0, phantomCash: 0, solUsd: 0, cash: 0, companies: 0, crypto: 0, listed: 0, posted: 0, lines: [] as Picture["lines"], open: [] as Array<{ id: string; label: string; usd: number }> };
  return (
    <div className="mb-2 rounded-lg bg-bg px-2.5 py-2">
      <p className="text-[10px] text-subtle">Your money</p>
      <p className="font-mono text-lg tabular-nums tracking-tight">{pic ? `$${row.total.toFixed(2)}` : owner ? "…" : "$0.00"}</p>
      <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-subtle">
        <li className="flex justify-between gap-2"><span>USDC</span><span>${row.usdc.toFixed(2)}</span></li>
        <li className="flex justify-between gap-2"><span>CASH</span><span>${row.phantomCash.toFixed(2)}</span></li>
        <li className="flex justify-between gap-2"><span>SOL</span><span>{row.sol > 0 ? row.sol.toFixed(4) : "0"}{row.solUsd > 0 ? ` · $${row.solUsd.toFixed(2)}` : ""}</span></li>
        {row.lines.slice(0, 8).map((line) => (
          <li key={line.symbol} className="flex justify-between gap-2"><span>{line.symbol}</span><span>{line.usd > 0 ? `$${line.usd.toFixed(2)}` : line.ui.toFixed(4)}</span></li>
        ))}
      </ul>
      {row.open.slice(0, 3).map((line) => (
        <p key={line.id} className="mt-1 truncate font-mono text-[10px] text-fg">{line.label} ${line.usd.toFixed(2)}</p>
      ))}
    </div>
  );
}

function ChainChip({ owner, cash }: { owner: string; cash: number }) {
  const [pic, setPic] = useState<Picture | null>(null);
  useEffect(() => {
    if (!owner) {
      setPic(null);
      return;
    }
    let live = true;
    const pull = () => {
      Promise.all([
        readChain(owner),
        loadPulse().catch(() => ({ rows: [] })),
      ]).then(async ([chain, pulse]) => {
        if (!live) return;
        const tape = await quoteHeld(chain.tokens.map((t) => t.mint), pulse.rows).catch(() => pulse.rows);
        if (!live) return;
        setPic(buildPicture({
          owner,
          sol: chain.sol,
          tokens: chain.tokens.map((t) => ({ mint: t.mint, ui: t.ui, symbol: t.symbol })),
          tape,
          cash,
          house: null,
        }));
      }).catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    const stop = onTrades(pull);
    return () => {
      live = false;
      window.clearInterval(id);
      stop();
    };
  }, [owner, cash]);
  const total = pic?.total ?? 0;
  const chain = Math.max(0, total - (pic?.cash ?? 0));
  const sol = pic?.sol ?? 0;
  const book = pic?.cash ?? 0;
  return (
    <Link to="/vault" className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#050508] px-4 py-1.5">
      <p className="font-mono text-sm tabular-nums">{owner ? (pic ? `$${chain.toFixed(2)}` : "…") : "Your money"}</p>
      <p className="truncate font-mono text-[11px] text-subtle">
        {owner
          ? `${sol.toFixed(3)} SOL · Wallet $${(pic?.usdc ?? 0).toFixed(2)} · Book $${book.toFixed(2)}`
          : "Not connected"}
      </p>
    </Link>
  );
}
