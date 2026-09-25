import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FilmBand } from "@/components/film-band";
import { TabLead } from "@/components/tab-lead";
import { FillButton } from "@/components/fill-button";
import { CurveDesk } from "@/components/curve-desk";
import { AddMoneyScreen } from "@/components/add-money";
import { BasketDesk } from "@/components/basket-desk";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { JupBoard } from "@/components/jup-ticket";
import { LaunchDesk } from "@/components/launch-desk";
import { LendDesk } from "@/components/lend-desk";
import { MarketStream } from "@/components/market-stream";
import { PerpDesk } from "@/components/perp-desk";
import { RadarDesk } from "@/components/radar-desk";
import { OptionChain } from "@/components/option-chain";
import { type DeskMode } from "@/components/watchlist";
import { applyHouseDrop, loadHouseBook, markHouse, saveHouseBook, type HouseBook } from "@/lib/house-paper";
import { openChainCover } from "@/lib/cover-chain";
import { connectPhantom } from "@/lib/phantom";
import type { Side } from "@/lib/lmsr";
import { chainFor, formatStrike, type OptContract, type OptTenor } from "@/lib/option-chain";
import { settleOptions } from "@/lib/option-book";
import { getHouse, HOUSE_FALLBACK, formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
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
}: {
  frozen: boolean;
  chips: number;
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
  const [desk, setDesk] = useState<DeskMode>("spot");
  const [armed, setArmed] = useState(0);
  const [house, setHouse] = useState<HouseListing[]>(HOUSE_FALLBACK);
  const [book, setBook] = useState<HouseBook>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const [underId, setUnderId] = useState<string | null>(null);
  const [ticketSide, setTicketSide] = useState<"buy" | "sell">("buy");

  useEffect(() => {
    setBook(loadHouseBook());
  }, []);

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
  const equity = chips + mtm;
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
    ["spot", "Spot", "Buy or sell on Jupiter"],
    ["book", "Protect", "Peg last to the SPV mark"],
    ["options", "Options", "Call or put on the print"],
    ["perps", "Perps", "Levered long or short"],
    ["basket", "Index", "PRE8 basket"],
    ["lend", "Borrow", "Cash against a holding"],
    ["minty", "Launch", "Pump, LetsBonk, Clanker"],
    ["curve", "Curve", "Bonding curve"],
    ["wrap", "Radar", "Names off their mark"],
    ["eco", "Rails", "Jupiter, Meteora, Raydium"],
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-3 mt-3">
        <TabLead
          kicker="Trade"
          title="The ticket"
          accent="you sign it."
          line="Your size. Your side. The signature is the ticket already on this book."
          live={["Set the size in dollars.", "Pick buy or sell.", "Sign it through the ticket on this page."]}
          coming={["A central limit book."]}
        />
      </div>
      <section className="mx-3 mt-3 rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Ticket</p>
            <h2 className="mt-1 text-2xl">{under ? under.symbol : "PreStock"}</h2>
            <p className="mt-1 font-mono text-sm text-muted">
              {under ? `${formatUsd(under.last)} last` : "Waiting on the book."}
              {under?.mint ? ` · ${under.mint.slice(0, 4)}…${under.mint.slice(-4)}` : ""}
            </p>
          </div>
          <p className="font-mono text-3xl tabular-nums">${armed ? armed.toFixed(2) : "0.00"}</p>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {pre.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setUnderId(r.id)}
              className={cn(
                "min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold",
                under?.id === r.id ? "bg-accent text-accent-fg" : "bg-black/40 text-muted",
              )}
            >
              {r.symbol}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Dollars value={armed} onChange={setArmed} />
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTicketSide("buy")}
              className={cn("min-h-12 rounded-full px-5 text-sm font-semibold", ticketSide === "buy" ? "bg-accent text-accent-fg" : "bg-black/40")}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setTicketSide("sell")}
              className={cn("min-h-12 rounded-full px-5 text-sm font-semibold", ticketSide === "sell" ? "bg-accent text-accent-fg" : "bg-black/40")}
            >
              Sell
            </button>
          </div>
        </div>
        {under ? (
          <FillButton
            mint={under.mint}
            usd={armed}
            side={ticketSide}
            price={under.last}
            label={`Sign ${ticketSide} ${under.symbol}`}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
          />
        ) : (
          <p className="text-sm text-muted">No PreStock on the book to sign.</p>
        )}
      </section>
      <FilmBand poster="/images/markets-desk.jpg" label="The book is live." />
    <main className="m-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}
      <nav className="h-fit rounded-[22px] border border-white/10 bg-[#10131c] p-2 lg:overflow-auto">
        <div className="px-3 py-3">
          <p className="text-[11px] tracking-wide text-subtle uppercase">Cash</p>
          <p className="mt-1 font-mono text-3xl tabular-nums" suppressHydrationWarning>
            ${equity.toFixed(2)}
          </p>
          <p className={cn("mt-1 font-mono text-xs tabular-nums", pnl < 0 ? "text-down" : "text-accent")} suppressHydrationWarning>
            {pnl >= 0 ? "+" : ""}
            {pnl.toFixed(2)} on the book
          </p>
        </div>
        {desks.map(([id, label, hint]) => (
          <button
            key={id}
            type="button"
            aria-pressed={desk === id}
            onClick={() => setDesk(id)}
            className={cn(
              "mb-1 flex w-full flex-col items-start rounded-2xl px-3 py-2.5 text-left",
              desk === id ? "bg-accent text-accent-fg" : "hover:bg-white/5",
            )}
          >
            <span className="text-sm font-semibold">{label}</span>
            <span className={cn("text-[11px]", desk === id ? "text-accent-fg/70" : "text-subtle")}>{hint}</span>
          </button>
        ))}
      </nav>
      <div className="min-h-0 overflow-auto rounded-[22px] border border-white/10 bg-[#10131c]">

      {desk === "spot" ? <JupBoard names={pre} /> : null}
      {desk === "minty" ? <LaunchDesk /> : null}
      {desk === "curve" ? <CurveDesk /> : null}
      {desk === "perps" ? <PerpDesk house={pre} cash={chips} onDebit={onDebit} onCredit={onCredit} /> : null}
      {desk === "basket" ? <BasketDesk house={pre} cash={chips} onDebit={onDebit} /> : null}
      {desk === "lend" ? <LendDesk house={pre} onCredit={onCredit} onDebit={onDebit} /> : null}

      {desk === "book" ? <MarketStream house={pre} cash={chips} onDebit={onDebit} onCredit={onCredit} /> : null}
      {desk === "wrap" ? <RadarDesk house={pre} /> : null}
      {desk === "eco" ? <EcosystemDesk house={pre} /> : null}

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
          {under ? (
            <div className="px-4 pb-2">
              <p className="text-sm text-muted">
                {under.symbol} last {formatUsd(under.last)} · mark {formatUsd(under.mark)}. Put is insurance on last.
              </p>
              <p className="mt-1 truncate font-mono text-[11px] text-subtle">{under.mint}</p>
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
                  className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
                >
                  Insure last
                </button>
              </div>
            </div>
          ) : null}
          <div className="px-3 pb-3">
            <Dollars value={armed} onChange={setArmed} />
          </div>
          <OptionChain
            stock={under?.venue === "prestocks" ? under : house.find((h) => h.venue === "prestocks") ?? under}
            tenor={tenor}
            onTenor={setTenor}
            busy={busy}
            onBuy={(c) => void liftOpt(c)}
          />
        </>
      ) : null}
      </div>
    </main>
    </div>
  );
}
