import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCoins } from "@/components/coin-ticker";
import { FilmBand } from "@/components/film-band";
import { MarkChart } from "@/components/mark-chart";
import { TabLead } from "@/components/tab-lead";
import { PortfolioAnalytics } from "@/components/portfolio-analytics";
import { PortfolioNav } from "@/components/portfolio-nav";
import { PositionsBook } from "@/components/positions-book";
import { SavingsYield } from "@/components/savings-yield";
import { JumpStrip } from "@/components/jump-strip";
import { HoldingCards, type HoldingRow } from "@/components/holding-cards";
import { VaultAccounts } from "@/components/vault-accounts";
import { VaultSleeves } from "@/components/vault-sleeves";
import { WalletPicker } from "@/components/wallet-picker";
import { BACKPACK } from "@/lib/backpack";
import { loadHoldTape, type HoldMove } from "@/lib/hold-tape";
import { readChain, type ChainTx, type ChainWallet } from "@/lib/phantom";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { type HouseListing } from "@/lib/sol-house";
import { unwrapUsdc, wrapUsdc, wrappedUsdc } from "@/lib/vault-wrap";
import { CCYS, formatMoney, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { listTrades, onTrades, type TradeFill } from "@/lib/trade-log";
import { cn } from "@/lib/utils";

type Hold = {
  key: string;
  symbol: string;
  name: string;
  qty: number;
  value: number;
  last: number;
  change: number | null;
  where: HoldingRow["where"];
};

function bookUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function portfolioOf(
  names: HouseListing[],
  chain: ChainWallet | null,
  coins: Array<{ id: string; symbol: string; name: string; price: number; change: number }>,
): Hold[] {
  if (!chain) return [];
  const rows: Hold[] = [];
  const sol = coins.find((c) => c.symbol === "SOL");
  if (chain.sol > 0) {
    const last = sol?.price ?? 0;
    rows.push({ key: "sol", symbol: "SOL", name: "Solana", qty: chain.sol, value: chain.sol * last, last, change: sol?.change ?? null, where: "coin" });
  }
  const byMint = new Map<string, HouseListing>();
  for (const n of names) {
    if (n.venue === "prestocks" && !byMint.has(n.mint)) byMint.set(n.mint, n);
  }
  const byCoin = new Map(coins.map((c) => [c.id, c]));
  for (const token of chain.tokens) {
    if (!(token.ui > 0)) continue;
    const share = BACKPACK.find((row) => row.mint === token.mint);
    const house = byMint.get(token.mint);
    const coin = byCoin.get(token.mint);
    const stable = token.symbol === "USDC" || token.symbol === "CASH";
    const last = house?.last || coin?.price || (stable ? 1 : 0);
    const change = house && house.change24h != null && house.change24h !== -1 ? house.change24h * 100 : coin?.change ?? null;
    rows.push({
      key: token.mint,
      symbol: share?.symbol || house?.symbol || coin?.symbol || token.symbol,
      name: share ? `${share.name} · Backpack Securities` : house?.name || coin?.name || token.symbol,
      qty: token.ui,
      value: token.ui * last,
      last,
      change,
      where: share ? "share" : house ? "pre" : stable ? "cash" : "coin",
    });
  }
  rows.sort((a, b) => b.value - a.value || a.symbol.localeCompare(b.symbol));
  return rows;
}

type BookRow = { symbol: string; now: number; bought: number; sold: number };

function bookOf(fills: TradeFill[], holds: Hold[]): BookRow[] {
  const map = new Map<string, BookRow>();
  for (const h of holds) {
    if (h.symbol === "SOL" || h.symbol === "USDC" || h.symbol === "CASH") continue;
    map.set(h.symbol, { symbol: h.symbol, now: h.value, bought: 0, sold: 0 });
  }
  for (const f of fills) {
    if (f.side === "send" || !(f.usd > 0)) continue;
    const row = map.get(f.symbol) ?? { symbol: f.symbol, now: 0, bought: 0, sold: 0 };
    if (f.side === "buy") row.bought += f.usd;
    else row.sold += f.usd;
    map.set(f.symbol, row);
  }
  return [...map.values()].filter((r) => r.now > 0 || r.bought > 0 || r.sold > 0).sort((a, b) => b.now - a.now || b.bought - a.bought);
}

function Activity({ fills, txs }: { fills: TradeFill[]; txs: ChainTx[] }) {
  const rows = [
    ...fills.slice(0, 6).map((f) => ({ id: f.signature || `${f.symbol}-${f.at}`, title: `${f.side} ${f.symbol}`, sub: bookUsd(f.usd) })),
    ...txs.slice(0, 6).map((tx) => ({ id: tx.signature, title: tx.signature.slice(0, 8), sub: "On Solana" })),
  ].slice(0, 8);
  if (!rows.length) return <p className="mt-3 text-sm text-muted">Nothing signed from this account yet.</p>;
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id} className="flex items-baseline justify-between gap-3 border-t border-white/10 py-2">
          <span className="text-sm font-semibold">{row.title}</span>
          <span className="font-mono text-xs text-subtle">{row.sub}</span>
        </li>
      ))}
    </ul>
  );
}

export function VaultDesk({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = link?.address ?? "";
  const [snap, setSnap] = useState<{ owner: string; chain: ChainWallet } | null>(null);
  const [reading, setReading] = useState(false);
  const [tick, setTick] = useState(0);
  const [raw, setRaw] = useState("25");
  const [cap, setCap] = useState(100);
  const [fills, setFills] = useState<TradeFill[]>([]);
  const [moves, setMoves] = useState<Record<string, HoldMove>>({});
  const [name, setName] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const coins = useCoins();
  const chain = snap && snap.owner === owner ? snap.chain : null;
  const usdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
  const wrapped = owner ? wrappedUsdc(owner) : 0;
  const holds = useMemo(() => portfolioOf(names, chain, coins), [names, chain, coins]);
  const marked = useMemo(() => holds.map((row) => {
    const mv = moves[row.key];
    if (!mv) return row;
    const last = row.last > 0 ? row.last : mv.price;
    return { ...row, last, value: last > 0 ? row.qty * last : row.value, change: row.change ?? mv.day };
  }), [holds, moves]);
  const book = useMemo(() => bookOf(fills, marked), [fills, marked]);
  const net = marked.reduce((sum, row) => sum + row.value, 0);
  const move = marked.reduce((sum, row) => sum + (row.change == null ? 0 : row.value * (row.change / 100)), 0);
  const blended = net > 0 ? move / Math.max(net - move, 0.01) : 0;
  const waiting = !wallet.ready || (Boolean(owner) && reading && !chain);

  useEffect(() => {
    setCap(spendCap());
    setFills(listTrades());
    return onTrades(() => setFills(listTrades()));
  }, []);

  useEffect(() => {
    if (!owner) {
      setSnap(null);
      setReading(false);
      return;
    }
    let live = true;
    setReading(true);
    readChain(owner)
      .then((s) => {
        if (live) setSnap({ owner, chain: s });
      })
      .catch(() => {
        if (live) setSnap((cur) => (cur?.owner === owner ? cur : null));
      })
      .finally(() => {
        if (live) setReading(false);
      });
    return () => {
      live = false;
    };
  }, [owner, tick]);

  useEffect(() => {
    const mints = holds.map((row) => row.key).filter((key) => key.length >= 32 && key.length <= 48).slice(0, 30);
    if (!mints.length) return;
    let live = true;
    loadHoldTape({ data: { mints } })
      .then((tape) => {
        if (!live) return;
        const next: Record<string, HoldMove> = {};
        for (const row of tape) next[row.mint] = row;
        setMoves(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [chain]);

  function wrap(amount?: number) {
    if (!owner) return;
    const n = amount ?? Number(raw);
    if (!(n > 0)) return toast.error("Enter an amount.");
    try {
      wrapUsdc(owner, link?.label || "Wallet", n, usdc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not wrap.");
      return;
    }
    const r = wallet.add(n, "USD", "usdc");
    if (!r.ok) {
      unwrapUsdc(owner, n);
      toast.error(r.error);
      return;
    }
    setTick((t) => t + 1);
    toast.success(`Wrapped $${n.toFixed(2)}. It is still in the wallet.`);
  }

  function push(amount?: number) {
    if (!owner) return;
    const n = amount ?? Number(raw);
    if (!(n > 0)) return toast.error("Enter an amount.");
    if (n - wrapped > 0.001) return toast.error("Only wrapped USDC can be pushed back.");
    const r = wallet.release(n, link?.label || "Phantom");
    if (!r.ok) return toast.error(r.error);
    unwrapUsdc(owner, n);
    setTick((t) => t + 1);
    toast.success(`Pushed $${n.toFixed(2)} back to the wallet.`);
  }

  function wrapHeld() {
    if (!owner) return toast.error("Connect Phantom first.");
    const open = Math.round((usdc - wrapped) * 100) / 100;
    if (!(open > 0)) return toast.error("Nothing left to wrap.");
    setRaw(open.toFixed(2));
    wrap(open);
  }

  function sendBack() {
    if (!owner) return toast.error("Connect Phantom first.");
    const n = Math.round(wrapped * 100) / 100;
    if (!(n > 0)) return toast.error("Nothing wrapped to send back.");
    setRaw(n.toFixed(2));
    push(n);
  }

  const cards: HoldingRow[] = marked.map((row) => ({
    mint: row.key,
    symbol: row.symbol,
    name: row.name,
    qty: row.qty,
    value: row.value,
    where: row.where,
  }));

  return (
    <main className="space-y-3 px-3 py-3 lg:px-4">
      <JumpStrip />
      <PortfolioNav current="holdings" />
      <section className="px-2 pt-1">
        <p className="text-xs text-subtle">Portfolio</p>
        <p className="mt-1 font-mono text-5xl leading-none tracking-tight tabular-nums">{waiting ? "—" : bookUsd(net)}</p>
        <p className={cn("mt-2 font-mono text-sm tabular-nums", move < 0 ? "text-down" : "text-up")}>
          {waiting ? "" : `${move < 0 ? "" : "+"}${bookUsd(move)} today`}
        </p>
        <p className="mt-1 text-xs text-subtle">{owner ? `Buying power $${usdc.toFixed(2)} USDC` : "Connect a wallet to mark this account."}</p>
      </section>
      <MarkChart symbol="Portfolio" last={net} change={Number.isFinite(blended) ? blended : 0} valueLabel={waiting ? "$0.00" : bookUsd(net)} />
      <PositionsBook owner={owner} names={names} />
      <SavingsYield owner={owner} />
      <TabLead
        kicker="Portfolio"
        title="What this wallet holds,"
        accent="marked live."
        line="Each card is a token on this address. A Backpack Securities mint opens the share book. Hour, day, and week are the live prints. A blank week means the tape has no seven-day change."
        live={["Chain balance", "Hour, day, and week", "Backpack shares you actually hold"]}
        coming={["A broker account"]}
      />
      <VaultAccounts owner={owner} />
      <VaultSleeves owner={owner} onChain={usdc} onChange={() => setTick((n) => n + 1)} />
      <PortfolioAnalytics owner={owner} usdc={usdc} sol={chain?.sol ?? 0} heldUsd={net} dayMove={move} />

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] px-3 py-4">
        <div className="flex items-end justify-between gap-3 px-2">
          <div>
            <p className="font-mono text-4xl tabular-nums tracking-tight">{waiting ? "—" : bookUsd(net)}</p>
            <p className="mt-1 text-xs text-subtle">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)} · ${marked.length} held` : "No wallet connected."}</p>
          </div>
          <p className={cn("font-mono text-sm tabular-nums", move < 0 ? "text-down" : "text-up")}>{waiting ? "" : bookUsd(move)}</p>
        </div>
        {!waiting && marked.length === 0 ? (
          <div className="mt-4 px-2">
            <p className="text-sm text-muted">{owner ? "Nothing in this wallet yet." : "Connect a wallet."}</p>
            <Link to="/equities" className="mt-3 inline-flex min-h-12 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Open the share book</Link>
          </div>
        ) : null}
        <HoldingCards rows={cards} moves={moves} />
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] px-3 py-4">
        <div className="flex items-end justify-between gap-3 px-2">
          <p className="text-sm font-semibold">Bought and sold</p>
          <p className={cn("font-mono text-sm tabular-nums", book.reduce((s, r) => s + r.now + r.sold - r.bought, 0) < 0 ? "text-down" : "text-up")}>
            {bookUsd(book.reduce((s, r) => s + r.now + r.sold - r.bought, 0))}
          </p>
        </div>
        <p className="mt-1 px-2 text-xs text-subtle">Marked value now, plus what you sold, minus what you paid. Only swaps signed in this browser.</p>
        {book.length === 0 ? <p className="mt-3 px-2 text-sm text-muted">No name yet.</p> : null}
        <ul>
          {book.map((row) => {
            const result = row.now + row.sold - row.bought;
            return (
              <li key={row.symbol} className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.06] px-2 py-3">
                <span>
                  <span className="block text-sm font-semibold">{row.symbol}</span>
                  <span className="block font-mono text-[11px] text-subtle">In {bookUsd(row.bought)} · Out {bookUsd(row.sold)}</span>
                </span>
                <span className={cn("font-mono text-sm tabular-nums", result < 0 ? "text-down" : "text-up")}>{bookUsd(result)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Transactions</p>
        <Activity fills={fills} txs={chain?.txs ?? []} />
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm font-semibold">Cash sleeve</p>
        <p className="mt-1 text-xs text-muted">A wrap is a claim on USDC that stays in the wallet. Push sends the claim back.</p>
        <p className="mt-3 font-mono text-2xl tabular-nums">${wrapped.toFixed(2)} wrapped · ${usdc.toFixed(2)} USDC</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[25, 100, 500].map((n) => (
            <button key={n} type="button" onClick={() => setCap(setSpendCap(n))} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-white/10")}>${n} cap</button>
          ))}
        </div>
        {owner ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={raw} onChange={(e) => setRaw(e.target.value)} inputMode="decimal" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 font-mono text-sm outline-none" />
            <button type="button" onClick={wrapHeld} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Wrap</button>
            <button type="button" onClick={sendBack} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">Push back</button>
          </div>
        ) : (
          <div className="mt-3"><WalletPicker /></div>
        )}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm font-semibold">Named pockets</p>
        <ul className="mt-2 space-y-2">
          {wallet.w.vaults.length === 0 ? <li className="text-sm text-muted">None yet.</li> : null}
          {wallet.w.vaults.map((v) => (
            <li key={v.id} className="flex items-baseline justify-between text-sm">
              <span>{v.name}</span>
              <span className="font-mono tabular-nums">{formatMoney(v.balance, v.ccy)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none" />
          <select value={ccy} onChange={(e) => setCcy(e.target.value as Ccy)} className="min-h-11 rounded-full border border-white/10 bg-black/40 px-3 text-sm">
            {CCYS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button
            type="button"
            onClick={() => {
              const r = wallet.openVault(name, ccy);
              if (!r.ok) toast.error(r.error);
              else {
                setName("");
                toast.success("Pocket opened.");
              }
            }}
            className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
          >
            Open
          </button>
        </div>
      </section>
      <FilmBand poster="/images/orbit.jpg" label="The wallet stays the wallet." />
    </main>
  );
}
