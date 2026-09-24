import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
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
import type { Side } from "@/lib/lmsr";
import { chainFor, formatStrike, type OptContract, type OptTenor } from "@/lib/option-chain";
import { placeOption, settleOptions } from "@/lib/option-book";
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
        className="mt-1 min-h-12 w-full rounded-2xl bg-elevated px-4 text-lg font-semibold tabular-nums outline-none"
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
    setBusyKey(c.id);
    try {
      if (!(await ensureStack(spend))) return;
      const deb = await onDebit(spend, c.id);
      if (!deb.ok) {
        toast.error(deb.error ?? "Could not lift.");
        return;
      }
      const ticket = placeOption({
        underlyingId: c.underlyingId,
        symbol: c.symbol,
        kind: c.kind,
        strike: c.strike,
        tenor: c.tenor,
        expiryAt: c.expiryAt,
        spend,
        ask: c.ask,
      });
      if ("error" in ticket) {
        toast.error(ticket.error);
        await onCredit(spend, "opt:rollback");
        return;
      }
      toast.success(
        `${c.kind === "call" ? "Call" : "Put"} ${c.symbol} ${formatStrike(c.strike)} · $${spend}`,
      );
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
    <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)]">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}
      <nav className="border-b border-border lg:overflow-auto lg:border-r lg:border-b-0">
        <div className="px-4 py-4">
          <p className="text-[11px] tracking-wide text-subtle uppercase">Cash</p>
          <p className="mt-1 font-mono text-2xl tabular-nums" suppressHydrationWarning>
            ${equity.toFixed(2)}
          </p>
          <p className={cn("mt-1 font-mono text-xs tabular-nums", pnl < 0 ? "text-down" : "text-up")} suppressHydrationWarning>
            {pnl >= 0 ? "+" : ""}
            {pnl.toFixed(2)} today
          </p>
        </div>
        {desks.map(([id, label, hint]) => (
          <button
            key={id}
            type="button"
            aria-pressed={desk === id}
            onClick={() => setDesk(id)}
            className={cn(
              "flex w-full flex-col items-start px-4 py-2.5 text-left",
              desk === id ? "bg-accent text-accent-fg" : "hover:bg-elevated",
            )}
          >
            <span className="text-sm font-semibold">{label}</span>
            <span className={cn("text-[11px]", desk === id ? "text-accent-fg/70" : "text-subtle")}>{hint}</span>
          </button>
        ))}
      </nav>
      <div className="min-h-0 overflow-auto">

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
                    under?.id === r.id ? "bg-fg text-bg" : "bg-elevated text-muted",
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
                  className="inline-flex min-h-11 items-center rounded-full bg-elevated px-4 text-sm font-semibold"
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
                  className="min-h-11 rounded-full bg-fg px-4 text-sm font-semibold text-bg"
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
  );
}
