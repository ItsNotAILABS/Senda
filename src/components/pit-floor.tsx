import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoneyBar } from "@/components/money-bar";
import { CurveDesk } from "@/components/curve-desk";
import { AddMoneyScreen } from "@/components/add-money";
import { BasketDesk } from "@/components/basket-desk";
import { CoverDesk } from "@/components/cover-desk";
import { CrossSend } from "@/components/cross-send";
import { DeskStake } from "@/components/desk-stake";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { TradeBuy } from "@/components/jup-ticket";
import { LiveChart } from "@/components/price-chart";
import { LaunchDesk } from "@/components/launch-desk";
import { LendDesk } from "@/components/lend-desk";
import { MarketStream } from "@/components/market-stream";
import { PerpDesk } from "@/components/perp-desk";
import { PreDesk } from "@/components/pre-desk";
import { RadarDesk } from "@/components/radar-desk";
import { OfferingBook } from "@/components/offering-book";
import { OptionChain } from "@/components/option-chain";
import { DerivDesk } from "@/components/deriv-desk";
import { SolanaFloor } from "@/components/solana-floor";
import { SpotCards } from "@/components/world-desk";
import { XStockLane } from "@/components/xstock-desk";
import { ChainMount } from "@/components/trade-mounts";
import { applyHouseDrop, loadHouseBook, markHouse, saveHouseBook, type HouseBook } from "@/lib/house-paper";
import { openChainCover } from "@/lib/cover-chain";
import { connectPhantom } from "@/lib/phantom";
import type { Side } from "@/lib/lmsr";
import { chainFor, formatStrike, type OptContract, type OptTenor } from "@/lib/option-chain";
import { settleOptions } from "@/lib/option-book";
import { getChainTape, type ChainTape } from "@/lib/chain-tape";
import { getHouse, HOUSE_FALLBACK, formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type TradeTab =
  | "spot"
  | "world"
  | "comms"
  | "options"
  | "perps"
  | "pre"
  | "bridge"
  | "vault"
  | "tape"
  | "prog"
  | "book"
  | "basket"
  | "lend"
  | "minty"
  | "curve"
  | "wrap"
  | "eco"
  | "xstock"
  | "futures"
  | "loans"
  | "hedge"
  | "cover"
  | "pred"
  | "index"
  | "shares"
  | "chains"
  | "products";

export function PitFloor({
  frozen,
  chips,
  desk: startDesk,
  onBuyIn,
  onTrade,
  onCredit,
  onDebit,
}: {
  frozen: boolean;
  chips: number;
  desk?: string;
  onBuyIn: () => Promise<{ ok: boolean; error?: string }>;
  onTrade: (
    marketId: string,
    side: Side,
    spend: number,
  ) => Promise<{ ok: boolean; error?: string; cost?: number; shares?: number }>;
  onCredit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  onDebit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const opened = (startDesk as TradeTab) || "spot";
  const [addOpen, setAddOpen] = useState(false);
  const [desk, setDesk] = useState<TradeTab>(opened);
  useEffect(() => {
    if (!startDesk) return;
    setDesk(startDesk as TradeTab);
  }, [startDesk]);
  const [armed, setArmed] = useState(0);
  const [house, setHouse] = useState<HouseListing[]>(HOUSE_FALLBACK);
  const [book, setBook] = useState<HouseBook>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const [underId, setUnderId] = useState<string | null>(null);
  const [optKind, setOptKind] = useState<"call" | "put">("put");
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

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
            toast(
              t.pnl > 0
                ? `${t.symbol} ${t.kind} finished above the strike. Settle the cover on Cover.`
                : t.pnl < 0
                  ? `${t.symbol} ${t.kind} expired.`
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

  const desks: [TradeTab, string][] = [
    ["spot", "Quotes"],
    ["tape", "Coins"],
    ["xstock", "xStocks"],
    ["pre", "PreStocks"],
    ["world", "FX & metals"],
    ["comms", "Commodities"],
    ["index", "Indexes"],
    ["shares", "Shares"],
    ["perps", "Perps"],
    ["options", "Options"],
    ["pred", "Predict"],
    ["futures", "Futures"],
    ["products", "Products"],
    ["chains", "Chains"],
    ["vault", "Solana"],
    ["bridge", "Bridge"],
    ["lend", "Borrow"],
    ["loans", "Loans"],
    ["cover", "Cover"],
    ["hedge", "Hedge"],
    ["book", "Protect"],
    ["basket", "Index"],
    ["prog", "Programs"],
    ["minty", "Launch"],
    ["curve", "Curve"],
    ["wrap", "Radar"],
    ["eco", "Rails"],
  ];
  const blurb: Partial<Record<TradeTab, string>> = {
    spot: "A name, a last price, and a ticket. Phantom signs the swap.",
    world: "FX and metals. The spot you can keep is on the card.",
    comms: "Oil, energy, softs, and the metals you can hold.",
    index: "US500, US100, and the other indexes.",
    shares: "NVDA, AAPL, and the other listed names.",
    options: "A call or a put. The premium is the USDC you sign.",
    perps: "Margin and leverage. Phantom signs the order.",
    pred: "Above or below the print. You post USDC.",
    futures: "Long or short the implied valuation.",
    pre: "The pre-IPO book. Buy, cover, or spend against it.",
    bridge: "Move USDC to another chain. This wallet signs.",
    vault: "Everything this address holds, marked live.",
    tape: "Jupiter coins, including the ones under a cent.",
    xstock: "Listed shares. The token lands in the wallet.",
    prog: "The program book and the PRE8 index.",
    book: "Protect a name against the print.",
    basket: "Buy a pack of names. Each swap is signed.",
    lend: "Borrow against a holding. The token stays yours.",
    loans: "Each loan, its rate, and how it pays back.",
    minty: "Names that already trade. Buy one here.",
    curve: "A curve on a name. Phantom signs the swap.",
    wrap: "Cheapest and richest names versus the mark.",
    eco: "How a name settles, and a buy on the same list.",
    hedge: "Cover a drop. The premium is what you sign.",
    cover: "Cover a drop. The token stays in the wallet.",
    chains: "Solana signs here. Other chains sign through LI.FI.",
    products: "Every product on one card. The button is the route that product can sign.",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-3 mt-3">
        <MoneyBar />
      </div>
      <p className="mx-3 mt-3 font-mono text-xs text-muted" suppressHydrationWarning>
        {pnl >= 0 ? "+" : ""}
        {pnl.toFixed(2)} on the book
      </p>
      <main className="m-3 flex min-h-0 flex-1 flex-col gap-3">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}
      <nav className="sticky top-0 z-20 space-y-2 border-b border-white/10 bg-[#07070f]/95 px-1 py-2 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto">
          {desks.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={desk === id}
              onClick={() => setDesk(id)}
              className={cn("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold", desk === id ? "bg-white text-black" : "bg-[#2a2a2e] text-white/80")}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      {desk === "spot" ? null : <p className="px-1 text-xs text-subtle">{blurb[desk] || "Same books. Open More for the rest."}</p>}
      <div className={cn("min-h-0 flex-1 overflow-auto", desk === "spot" ? "" : "rounded-[22px] border border-white/10 bg-[#10131c]")}>

      {desk === "spot" ? <TradeBuy names={pre} /> : null}
      {desk === "tape" ? <TradeBuy names={pre} startLane="spot" /> : null}
      {desk === "xstock" ? <XStockLane /> : null}
      {desk === "world" ? (
        <>
          <SpotCards lane="all" />
          <DerivDesk lane="fx" lanes={["fx", "metals"]} />
        </>
      ) : null}
      {desk === "comms" ? (
        <>
          <SpotCards lane="metals" />
          <DerivDesk lane="metals" lanes={["metals", "energy", "softs", "crypto"]} />
        </>
      ) : null}
      {desk === "index" ? <DerivDesk lane="index" lanes={["index"]} /> : null}
      {desk === "shares" ? <DerivDesk lane="shares" lanes={["shares"]} /> : null}
      {desk === "chains" ? <ChainMount /> : null}
      {desk === "products" ? <OfferingBook /> : null}
      {desk === "perps" ? <PerpDesk house={pre} /> : null}
      {desk === "pred" ? <DeskStake names={pre} mode="pred" /> : null}
      {desk === "futures" ? <DeskStake names={pre} mode="perp" /> : null}
      {desk === "pre" ? <PreDesk names={pre} routes={[]} /> : null}
      {desk === "bridge" ? <div className="p-3">{owner ? <CrossSend owner={owner} /> : <p className="text-sm text-muted">Connect Phantom. That wallet signs the bridge.</p>}</div> : null}
      {desk === "vault" ? <TradeSolana house={pre} /> : null}
      {desk === "minty" ? <LaunchDesk names={pre} /> : null}
      {desk === "curve" ? <CurveDesk /> : null}
      {desk === "basket" ? <BasketDesk house={pre} /> : null}
      {desk === "lend" || desk === "loans" ? <LendDesk house={pre} /> : null}
      {desk === "book" ? <MarketStream house={pre} cash={chips} onDebit={onDebit} onCredit={onCredit} /> : null}
      {desk === "wrap" ? <RadarDesk house={pre} /> : null}
      {desk === "eco" || desk === "prog" ? <EcosystemDesk house={pre} /> : null}
      {desk === "cover" || desk === "hedge" ? <CoverDesk names={pre} /> : null}

      {desk === "options" && under ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex gap-1 overflow-x-auto px-3 py-3">
              {pre.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setUnderId(r.id)}
                  className={cn(
                    "min-h-10 shrink-0 rounded-full px-3 text-sm font-medium",
                    under.id === r.id ? "bg-accent text-accent-fg" : "bg-black/40 text-muted",
                  )}
                >
                  {r.symbol}
                </button>
              ))}
            </div>
            <div className="px-4 pb-2">
              <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Future purchase</p>
              <p className="mt-1 text-2xl tracking-tight">{under.symbol}</p>
              <p className="mt-1 text-sm text-muted">
                Last {formatUsd(under.last)} · mark {formatUsd(under.mark)}. A call is the right to the upside. A put is insurance on last. The premium is USDC you sign. The token stays in your wallet.
              </p>
              <div className="mt-3">
                <LiveChart mint={under.mint} symbol={under.symbol} live={under.last} />
              </div>
            </div>
            <OptionChain stock={under} tenor={tenor} onTenor={setTenor} busy={busy} onBuy={(c) => void liftOpt(c)} />
          </div>
          <aside className="border-t border-white/10 p-4 lg:border-t-0 lg:border-l">
            <p className="text-sm font-semibold">Sign the premium</p>
            <p className="mt-1 text-xs text-muted">Phantom signs USDC. Settle it on Cover if the print hits the strike.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["call", "put"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setOptKind(k)} className={cn("min-h-11 rounded-full text-sm font-semibold capitalize", optKind === k ? "bg-white text-black" : "border border-white/10")}>
                  {k}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {(["1d", "7d"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTenor(t)} className={cn("min-h-10 flex-1 rounded-full font-mono text-xs", tenor === t ? "bg-accent text-accent-fg" : "border border-white/10")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {[1, 10, 25].map((n) => (
                <button key={n} type="button" onClick={() => setArmed(n)} className={cn("min-h-10 flex-1 rounded-full font-mono text-sm", armed === n ? "bg-accent text-accent-fg" : "border border-white/10")}>
                  ${n}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const row = chainFor(under, tenor).find((c) => c.atm && c.kind === optKind);
                if (row) void liftOpt(row);
                else toast.error("No strike on that name yet.");
              }}
              className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              {busy ? "Waiting for the wallet…" : `Sign ${optKind} · $${armed || 0}`}
            </button>
          </aside>
        </div>
      ) : null}
      </div>
    </main>
    </div>
  );
}

const EMPTY_TAPE: ChainTape = { ok: false, rows: [], note: "", jupiter: false, defillama: false };

function TradeSolana({ house }: { house: HouseListing[] }) {
  const [tape, setTape] = useState<ChainTape>(EMPTY_TAPE);
  useEffect(() => {
    let live = true;
    getChainTape()
      .then((next) => live && setTape(next))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return <SolanaFloor house={house} tape={tape} />;
}
