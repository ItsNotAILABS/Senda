import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FilmBand } from "@/components/film-band";
import { ChainBook } from "@/components/chain-book";
import { CoinDesk } from "@/components/coin-desk";
import { ProgramDesk } from "@/components/program-desk";
import { PassportBar } from "@/components/passport-bar";
import { FillButton } from "@/components/fill-button";
import { CurveDesk } from "@/components/curve-desk";
import { AddMoneyScreen } from "@/components/add-money";
import { BasketDesk } from "@/components/basket-desk";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { LaunchDesk } from "@/components/launch-desk";
import { LendDesk } from "@/components/lend-desk";
import { MarketStream } from "@/components/market-stream";
import { PerpDesk } from "@/components/perp-desk";
import { RadarDesk } from "@/components/radar-desk";
import { OptionChain } from "@/components/option-chain";
import { PrintChart } from "@/components/print-chart";
import { CoverDesk } from "@/components/cover-desk";
import { FuturesDesk } from "@/components/futures-desk";
import { LoansDesk } from "@/components/loans-desk";
import { SwapDesk } from "@/components/swap-desk";
import { TradeTerminal } from "@/components/backpack-desk";
import { EquityMount, HedgeMount, PreMount } from "@/components/trade-mounts";
import { type DeskMode } from "@/components/watchlist";
import { DerivDesk } from "@/components/deriv-desk";
import { CommodityBook } from "@/components/commodity-book";
import { SmartScreen } from "@/components/smart-screen";
import { Terminal } from "@/components/terminal";
import { SolanaFloor } from "@/components/solana-floor";
import { applyHouseDrop, loadHouseBook, markHouse, saveHouseBook, type HouseBook } from "@/lib/house-paper";
import { openChainCover } from "@/lib/cover-chain";
import { connectPhantom, readChain } from "@/lib/phantom";
import type { Side } from "@/lib/lmsr";
import { chainFor, formatStrike, type OptContract, type OptTenor } from "@/lib/option-chain";
import { settleOptions } from "@/lib/option-book";
import { getHouse, HOUSE_FALLBACK, formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

function Dollars({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block px-1 pb-3">
      <span className="text-xs font-medium text-subtle">Dollars</span>
      <input
        inputMode="decimal"
        value={value ? String(value) : ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder="0"
        className="mt-1 min-h-12 w-full rounded-full border border-white/10 bg-black/40 px-4 font-mono text-lg tabular-nums outline-none"
      />
    </label>
  );
}

export function PitFloor({
  frozen,
  chips,
  onBuyIn,
  onTrade,
  onCredit,
  onDebit,
  start,
  lane,
}: {
  frozen: boolean;
  chips: number;
  start?: DeskMode;
  lane?: "solana";
  onBuyIn: () => Promise<{ ok: boolean; error?: string }>;
  onTrade: (
    marketId: string,
    side: Side,
    spend: number,
  ) => Promise<{ ok: boolean; error?: string; cost?: number; shares?: number }>;
  onCredit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  onDebit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [desk, setDesk] = useState<DeskMode>(start ?? "spot");
  useEffect(() => {
    if (start) setDesk(start);
  }, [start]);
  const [armed, setArmed] = useState(0);
  const [house, setHouse] = useState<HouseListing[]>(HOUSE_FALLBACK);
  const [book, setBook] = useState<HouseBook>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const [underId, setUnderId] = useState<string | null>(null);
  const [ticketSide, setTicketSide] = useState<"buy" | "sell">("buy");
  const [walletLine, setWalletLine] = useState("");
  const linked = useWallet().w.links.find((l) => l.kind === "phantom" || l.kind === "solana");

  useEffect(() => {
    setBook(loadHouseBook());
  }, []);

  useEffect(() => {
    if (!linked) {
      setWalletLine("");
      return;
    }
    let live = true;
    readChain(linked.address)
      .then((s) => {
        if (!live) return;
        const usdc = s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
        setWalletLine(`${s.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL · ${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`);
      })
      .catch(() => live && setWalletLine("Could not read the wallet."));
    return () => {
      live = false;
    };
  }, [linked?.address]);

  useEffect(() => {
    let cancelled = false;
    const pull = () =>
      getHouse()
        .then((rows) => {
          if (cancelled || !rows.length) return;
          setHouse(rows);
          setUnderId((cur) => cur ?? rows.find((r) => r.venue === "prestocks")?.id ?? rows[0]?.id ?? null);
          const prices = Object.fromEntries(rows.map((r) => [r.id, r.last]));
          const settled = settleOptions(prices);
          for (const t of settled) {
            if (t.pnl > 0) void onCredit(t.pnl + t.spend, t.id);
            else if (t.pnl === 0) void onCredit(t.spend, t.id);
            toast(
              t.pnl > 0
                ? `${t.symbol} ${t.kind} paid`
                : t.pnl < 0
                  ? `${t.symbol} ${t.kind} expired`
                  : `${t.symbol} push`,
            );
          }
        })
        .catch(() => {
          /* keep last */
        });
    void pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [onCredit]);

  const pre = useMemo(() => house.filter((r) => r.venue === "prestocks"), [house]);
  const under = pre.find((h) => h.id === underId) ?? pre[0] ?? null;
  const cost = pre.reduce((s, r) => s + (book[r.id]?.cost ?? 0), 0);
  const mtm = pre.reduce((s, r) => s + markHouse(book[r.id], r.last), 0);
  const pnl = mtm - cost;
  const busy = Boolean(busyKey);

  async function ensureStack(spend: number): Promise<boolean> {
    if (frozen) {
      toast.error("Book is frozen.");
      return false;
    }
    if (!(spend > 0)) {
      toast.error("Enter dollars.");
      return false;
    }
    if (chips >= spend) return true;
    toast.error("Not enough cash.");
    setAddOpen(true);
    return false;
  }

  async function dropHouse(stock: HouseListing, side: Side) {
    const spend = armed;
    setBusyKey(`${stock.id}:${side}`);
    try {
      if (!(await ensureStack(spend))) return;
      const res = await onTrade(stock.id, side, spend);
      if (!res.ok) {
        toast.error(res.error ?? "Fill rejected.");
        return;
      }
      const next = applyHouseDrop(loadHouseBook(), stock.id, side, spend, stock.last);
      saveHouseBook(next);
      setBook(next);
      toast.success(`${side === "yes" ? "Bought" : "Sold"} ${stock.symbol} · $${spend}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not fill.");
    } finally {
      setBusyKey(null);
    }
  }

  async function liftOpt(c: OptContract) {
    const spend = armed;
    const stock = pre.find((h) => h.id === c.underlyingId);
    setBusyKey(c.id);
    try {
      if (!(spend > 0)) throw new Error("Enter the size. The premium is a slice of it.");
      if (!stock) throw new Error("That name is not on the book.");
      const owner = await connectPhantom();
      const premium = Math.max(1, Math.round(spend * c.ask));
      const row = await openChainCover({
        owner,
        kind: c.kind === "put" ? "drop" : "life",
        title: `${c.symbol} ${c.kind} ${formatStrike(c.strike)}`,
        symbol: stock.symbol,
        mint: stock.mint,
        strike: c.strike,
        cover: spend,
        premium,
        days: c.tenor === "7d" ? 7 : 1,
      });
      toast.success(`Premium signed. ${row.sig.slice(0, 8)}… Settle it on Cover.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The premium did not send.");
    } finally {
      setBusyKey(null);
    }
  }

  const desks = [
    ["spot", "Quotes"],
    ["smart", "Smart"],
    ["pre", "PreStocks"],
    ["xstock", "xStocks"],
    ["term", "Shares"],
    ["world", "FX & metals"],
    ["comms", "Commodities"],
    ["options", "Options"],
    ["perps", "Perps"],
    ["futures", "Futures"],
    ["hedge", "Hedge"],
    ["cover", "Cover"],
    ["loans", "Loans"],
    ["bridge", "Bridge"],
    ["tape", "Coins"],
    ["lend", "Borrow"],
    ["basket", "Index"],
    ["minty", "Launch"],
    ["curve", "Curve"],
    ["book", "Protect"],
    ["wrap", "Radar"],
    ["eco", "Rails"],
    ["prog", "Programs"],
    ["vault", "Solana"],
  ] as const;
  const about: Record<string, string> = {
    term: "Backpack shares Jupiter verifies, and the PreStock pool by real depth. You sign the swap.",
    spot: "A name, a last price, and a ticket. Phantom signs the swap.",
    smart: "Direct against routed. The cheaper lane is the one that pays more token. Senda fee is zero.",
    world: "FX, metals, oil, indexes. The quote is the live book, not a picture.",
    comms: "Commodities you can read and trade from the same list.",
    options: "A call or a put on a PreStock. The premium is what you sign.",
    perps: "A perp on a name. Margin and leverage are on the ticket.",
    pre: "The PreStock book, inside Trade.",
    bridge: "Move USDC to another chain. The source wallet signs.",
    vault: "What this Solana address holds.",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#07070f]/95 px-3 py-2 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto">
          {desks.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDesk(id)}
              className={cn("min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold", desk === id ? "bg-white text-black" : "bg-white/10 text-white/80")}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">{about[desk] || "Every book is on the row. Swipe for the rest."}</p>
      </div>
      <div className="mx-3 mt-2 flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs text-muted">
        <span suppressHydrationWarning>{walletLine || (chips > 0 ? `$${chips.toFixed(2)} USDC` : "Connect Phantom to trade.")}</span>
        <span className={cn(pnl < 0 ? "text-down" : "text-accent")} suppressHydrationWarning>
          {pnl >= 0 ? "+" : ""}
          {pnl.toFixed(2)} on the book
        </span>
      </div>
    <main className="m-3 min-h-0 flex-1">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}
      <div className="min-h-0 overflow-auto rounded-[22px] border border-white/10 bg-[#10131c]">

      {desk === "term" ? <TradeTerminal names={pre} /> : null}
      {desk === "spot" ? <SpotQuotes house={pre} openSolana={lane === "solana"} /> : null}
      {desk === "smart" ? <SmartScreen /> : null}
      {desk === "comms" ? <CommodityBook mode="trade" /> : null}
      {desk === "tape" ? <CoinDesk /> : null}
      {desk === "prog" ? <ProgramDesk /> : null}
      {desk === "vault" ? (
        <div className="space-y-3 p-3">
          <PassportBar />
          <ChainBook />
        </div>
      ) : null}
      {desk === "world" ? <DerivDesk /> : null}
      {desk === "minty" ? <LaunchDesk /> : null}
      {desk === "curve" ? <CurveDesk /> : null}
      {desk === "perps" ? <PerpDesk /> : null}
      {desk === "basket" ? <BasketDesk house={pre} cash={chips} onDebit={onDebit} /> : null}
      {desk === "lend" ? <LendDesk house={pre} onCredit={onCredit} onDebit={onDebit} /> : null}

      {desk === "book" ? <MarketStream house={pre} cash={chips} onDebit={onDebit} onCredit={onCredit} /> : null}
      {desk === "wrap" ? <RadarDesk house={pre} /> : null}
      {desk === "eco" ? <EcosystemDesk house={pre} /> : null}
      {desk === "pre" ? <PreMount /> : null}
      {desk === "xstock" ? <EquityMount /> : null}
      {desk === "futures" ? <FuturesDesk names={pre} /> : null}
      {desk === "loans" ? <LoansDesk /> : null}
      {desk === "bridge" ? <SwapDesk /> : null}
      {desk === "hedge" ? <HedgeMount /> : null}
      {desk === "cover" ? <CoverDesk names={pre} /> : null}

      {desk === "options" ? (
        <>
          <div className="flex gap-1 overflow-x-auto px-3 py-3">
            {house
              .filter((r) => r.venue === "prestocks")
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setUnderId(r.id)}
                  className={cn(
                    "min-h-10 shrink-0 rounded-full px-3 text-sm font-medium",
                    under?.id === r.id ? "bg-accent text-accent-fg" : "bg-black/40 text-muted",
                  )}
                >
                  {r.symbol}
                </button>
              ))}
          </div>
          <div className="grid items-start gap-3 px-3 pb-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <div>
              {under ? <PrintChart mint={under.mint} symbol={under.symbol} className="h-[360px]" /> : null}
              {under ? (
                <div className="px-1 pt-3">
                  <p className="text-sm text-muted">
                    {under.symbol} last {formatUsd(under.last)} · mark {formatUsd(under.mark)}. The chain is priced off last. A put is insurance on it.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <FillButton
                      mint={under.mint}
                      usd={10}
                      price={under.last}
                      label={`Buy $10 ${under.symbol}`}
                      className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
                    />
                    <Link
                      to="/wallet"
                      search={{ buy: under.symbol }}
                      className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-semibold"
                    >
                      Pay with SOL
                    </Link>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const put = chainFor(under, tenor).find((c) => c.atm && c.kind === "put");
                        if (put) void liftOpt(put);
                      }}
                      className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
                    >
                      Insure last
                    </button>
                  </div>
                  <div className="pt-3">
                    <Dollars value={armed} onChange={setArmed} />
                  </div>
                </div>
              ) : null}
            </div>
            <OptionChain
              stock={under?.venue === "prestocks" ? under : house.find((h) => h.venue === "prestocks") ?? under}
              tenor={tenor}
              onTenor={setTenor}
              busy={busy}
              onBuy={(c) => void liftOpt(c)}
            />
          </div>
        </>
      ) : null}
      </div>
    </main>
      <FilmBand poster="/images/markets-desk.jpg" label="The book is live." />
    </div>
  );
}

function SpotQuotes({ house, openSolana }: { house: HouseListing[]; openSolana?: boolean }) {
  const [lane, setLane] = useState<"trade" | "solana">(openSolana ? "solana" : "trade");
  if (lane === "solana") return <SolanaFloor house={house} />;
  return <Terminal lane={lane} onLane={setLane} />;
}
