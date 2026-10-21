import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Spark } from "@/components/desk-card";
import { LendDesk } from "@/components/lend-desk";
import { OwnedCards } from "@/components/owned-cards";
import { SavingsLane } from "@/components/savings-lane";
import { BookView } from "@/components/book-view";
import { ActivityTape } from "@/components/activity-tape";
import { FillCard } from "@/components/fill-card";
import { FilmBand } from "@/components/film-band";
import { LiveChart } from "@/components/price-chart";
import { TabLead } from "@/components/tab-lead";
import { WalletPicker } from "@/components/wallet-picker";
import { connectPhantom, readChain, type ChainWallet } from "@/lib/phantom";
import { runPrestock, spendable } from "@/lib/prestock";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { unwrapUsdc, wrapUsdc, wrappedUsdc } from "@/lib/vault-wrap";
import { CCYS, formatMoney, type Ccy } from "@/lib/wallet";
import { lotsFrom, readFills } from "@/lib/book";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const STAKED = new Set(["JitoSOL", "mSOL", "bSOL", "INF", "JupSOL"]);
const LOGO_SYMBOLS = new Set(["SPACEX", "OPENAI", "ANTHROPIC", "ANDURIL", "NEURALINK", "FIGUREAI", "KALSHI", "POLYMARKET"]);

const ACCOUNTS = [
  { symbol: "SOL", mint: "", note: "The Phantom address itself. SOL lands here." },
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", note: "Dollars. Send and shop pay from here." },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", note: "Tether. Some desks take this when they do not take USDC." },
  { symbol: "PYUSD", mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", note: "PayPal’s dollar." },
  { symbol: "EURC", mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", note: "Euros. Only this Phantom can spend them." },
  { symbol: "JitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", note: "Staked SOL. It is not the SOL line." },
];

type Position = {
  mint: string;
  symbol: string;
  name: string;
  tokens: number;
  last: number;
  value: number;
  premium: number | null;
};

function logoSrc(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!LOGO_SYMBOLS.has(s)) return null;
  return `/logos/${s.toLowerCase()}.png`;
}

function bookUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function tokenQty(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function positionsOf(names: HouseListing[], chain: ChainWallet | null): Position[] {
  if (!chain) return [];
  const byMint = new Map<string, HouseListing>();
  for (const n of names) {
    if (n.venue !== "prestocks" || byMint.has(n.mint)) continue;
    byMint.set(n.mint, n);
  }
  const rows: Position[] = [];
  for (const token of chain.tokens) {
    const house = byMint.get(token.mint);
    if (!house || !(token.ui > 0)) continue;
    rows.push({
      mint: house.mint,
      symbol: house.symbol,
      name: house.name,
      tokens: token.ui,
      last: house.last,
      value: token.ui * house.last,
      premium: house.premium,
    });
  }
  rows.sort((a, b) => b.value - a.value || a.symbol.localeCompare(b.symbol));
  return rows;
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
  const [name, setName] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const [sellUsd, setSellUsd] = useState<Record<string, string>>({});
  const [selling, setSelling] = useState("");
  const [sold, setSold] = useState<{ symbol: string; usd: number; sig: string } | null>(null);
  const [history, setHistory] = useState<Array<{ day: string; usd: number }>>([]);
  const [px, setPx] = useState<Record<string, number>>({});
  const [chg, setChg] = useState<Record<string, number>>({});
  const [openMint, setOpenMint] = useState("");
  const chain = snap && snap.owner === owner ? snap.chain : null;
  const usdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
  const wrapped = owner ? wrappedUsdc(owner) : 0;
  const rows = useMemo(() => positionsOf(names, chain), [names, chain]);
  const solPx = px[SOL_MINT] || 0;
  const solUsd = (chain?.sol ?? 0) * solPx;
  const marked = useMemo(() => {
    if (!chain) return 0;
    return solUsd + chain.tokens
      .filter((token) => token.ui > 0 && !["USDC", "USDT", "PYUSD", "EURC"].includes(token.symbol))
      .reduce((sum, token) => {
        const house = names.find((name) => name.mint === token.mint);
        const last = house?.last || px[token.mint] || 0;
        return sum + token.ui * last;
      }, 0);
  }, [chain, names, px, solUsd]);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const waiting = !wallet.ready || (Boolean(owner) && reading && !chain);

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    if (!chain) return;
    const ids = [...new Set([SOL_MINT, ...chain.tokens.filter((token) => token.ui > 0 && token.mint).map((token) => token.mint)])].slice(0, 50);
    if (!ids.length) return;
    let live = true;
    fetch(`https://lite-api.jup.ag/price/v3?ids=${ids.join(",")}`, { headers: { accept: "application/json" } })
      .then((res) => res.json())
      .then((body: Record<string, { usdPrice?: number; priceChange24h?: number }>) => {
        if (!live || !body) return;
        const next: Record<string, number> = {};
        const moves: Record<string, number> = {};
        for (const id of ids) {
          const price = Number(body[id]?.usdPrice);
          if (price > 0) next[id] = price;
          const move = Number(body[id]?.priceChange24h);
          if (Number.isFinite(move)) moves[id] = move;
        }
        setPx(next);
        setChg(moves);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [chain, tick]);
  useEffect(() => {
    if (!owner || waiting) return;
    const now = Math.round((marked + usdc) * 100) / 100;
    if (!(now > 0)) return;
    const key = "senda.wealth.v1";
    let prev: Array<{ day: string; usd: number }> = [];
    try {
      prev = JSON.parse(window.localStorage.getItem(key) || "[]");
      if (!Array.isArray(prev)) prev = [];
    } catch {
      prev = [];
    }
    const day = new Date().toISOString().slice(0, 10);
    const next = [{ day, usd: now }, ...prev.filter((p) => p.day !== day)].slice(0, 30);
    window.localStorage.setItem(key, JSON.stringify(next));
    setHistory(next);
  }, [owner, waiting, marked, usdc]);
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
        if (!live) return;
        setSnap({ owner, chain: s });
      })
      .catch(() => {
        if (!live) return;
        setSnap((cur) => (cur?.owner === owner ? cur : null));
      })
      .finally(() => {
        if (live) setReading(false);
      });
    const again = () => {
      readChain(owner)
        .then((s) => live && setSnap({ owner, chain: s }))
        .catch(() => {});
    };
    window.addEventListener("senda-chain", again);
    return () => {
      live = false;
      window.removeEventListener("senda-chain", again);
    };
  }, [owner, tick]);

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
    if (!(open > 0)) return toast.error("Nothing left in Phantom to wrap.");
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

  function dollarsOf(row: Position): number {
    const cap = spendable(row.tokens, row.last);
    if (!(row.last > 0) || !(cap > 0)) return 0;
    const typed = sellUsd[row.mint];
    const n = typed == null || typed === "" ? cap : Number(typed);
    if (!(n > 0)) return 0;
    return Math.min(Math.round(n * 100) / 100, cap);
  }

  async function sellHolding(row: Position) {
    const usd = dollarsOf(row);
    const price = row.last;
    const mint = row.mint;
    if (!(price > 0)) {
      toast.error("No live price. Nothing was sent.");
      return;
    }
    if (!(usd > 0)) {
      toast.error("Enter a size.");
      return;
    }
    if (selling) return;
    setSelling(mint);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({ side: "sell", owner, mint, usd, price });
      setSold({ symbol: row.symbol, usd, sig: done.signature });
      setTick((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    } finally {
      setSelling("");
    }
  }

  return (
    <main className="space-y-3 px-3 py-3 lg:px-4">
      {sold ? (
        <FillCard
          title={`Sold ${sold.symbol}`}
          symbol={sold.symbol}
          amount={`$${sold.usd.toFixed(2)}`}
          paid={sold.symbol}
          received={`$${sold.usd.toFixed(2)} USDC`}
          where="Phantom"
          when="Just now"
          sig={sold.sig}
          onDone={() => setSold(null)}
        />
      ) : null}
      <TabLead
        kicker="Portfolio"
        title="PreStocks you hold,"
        accent="marked live."
        line="The total is tokens in this wallet times the last print. Nothing on the book is a paper share."
        live={["Chain balance", "Value at the live last", "Wrap USDC and send it back"]}
        coming={["A broker account", "Margin"]}
      />

      <section className="overflow-hidden rounded-[28px] border border-[#c6f56a]/25 bg-[#070b08] px-4 py-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/55">Portfolio</p>
          <p className="font-mono text-[11px] text-[#c6f56a]">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected"}</p>
        </div>
        <p className="mt-3 font-mono text-[42px] leading-none tabular-nums">{waiting ? "—" : bookUsd(marked + usdc)}</p>
        <p className="mt-2 text-sm text-white/40">{owner ? "Cash, crypto, names, shares, and staked. Each line is what this wallet holds." : "Connect Phantom to mark this account."}</p>
        <p className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-3 text-sm">
          <span className="text-white/45">Buying power</span>
          <span className="font-mono tabular-nums">{chain ? `$${usdc.toFixed(2)} USDC` : "—"}</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Line k="SOL" v={chain ? (solPx > 0 ? bookUsd(solUsd) : chain.sol >= 1 ? chain.sol.toFixed(3) : chain.sol.toFixed(4)) : "—"} />
          <Line k="USDC" v={chain ? usdc.toFixed(2) : "—"} />
          <Line k="CASH" v={owner ? wrapped.toFixed(2) : "—"} />
          <Line k="Held" v={waiting ? "—" : bookUsd(marked)} />
          <Line k="Companies" v={rows.length ? `${rows.length}` : "—"} />
          <Line k="Crypto" v={chain ? String(chain.tokens.filter((t) => t.ui > 0 && !["USDC", "USDT", "PYUSD", "EURC"].includes(t.symbol) && !rows.some((r) => r.mint === t.mint)).length) : "—"} />
          <Line k="Listed" v={chain ? String(chain.tokens.filter((t) => t.ui > 0 && /x$/i.test(t.symbol)).length) : "—"} />
          <Line k="In a pot" v={bookUsd(wallet.w.balances.USD || 0)} />
        </div>
        {!owner ? <p className="mt-3 text-sm text-white/50">Connect Phantom to mark this account.</p> : null}
        <div className="mt-4">
          <OwnedCards
            sol={chain?.sol ?? 0}
            solPx={solPx}
            tokens={chain?.tokens ?? []}
            marks={names.filter((n) => n.last > 0).map((n) => ({ mint: n.mint, last: n.last, name: n.name }))}
          />
        </div>
      </section>

      <div className="flex gap-2">
        {(
          [
            ["port-holdings", "Holdings"],
            ["port-loans", "Loans"],
            ["port-savings", "Savings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/80"
          >
            {label}
          </button>
        ))}
      </div>
      <div id="port-holdings" className="space-y-3">

      <section className="rounded-[28px] border border-white/10 bg-[#101114] px-4 py-4">
        <p className="text-sm font-semibold">On this Phantom</p>
        <p className="mt-1 text-xs text-white/45">{owner ? "A line is open only when this address holds it." : "Connect Phantom. These lines stay closed until it does."}</p>
        <ul className="mt-2">
          {ACCOUNTS.map((line) => {
            const ui = line.symbol === "SOL" ? (chain?.sol ?? 0) : (chain?.tokens.find((t) => t.mint === line.mint || t.symbol === line.symbol)?.ui ?? 0);
            const open = ui > 0;
            return (
              <li key={line.symbol} className="flex items-start justify-between gap-3 border-t border-white/10 py-3">
                <span>
                  <span className="block text-sm font-semibold">{line.symbol} · {open ? "open" : "closed"}</span>
                  <span className="block text-xs text-white/40">{line.note}</span>
                </span>
                <span className="font-mono text-sm tabular-nums">{open ? (ui >= 1 ? ui.toFixed(4) : ui.toFixed(6)) : "0"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {chain ? (
        <Allocation chain={chain} names={names} owner={owner} usdc={usdc} history={history} px={px} chg={chg} solPx={solPx} />
      ) : null}

      {chain && chain.tokens.some((token) => token.ui > 0) ? (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
          <p className="text-sm font-semibold">Held</p>
          <p className="mt-1 text-xs text-white/40">A buy shows here once the token is in this wallet. Tap a line for its chart.</p>
          {(() => {
            const token = chain.tokens.find((t) => t.mint === openMint && t.ui > 0) ?? chain.tokens.find((t) => t.ui > 0);
            if (!token) return null;
            const house = names.find((name) => name.mint === token.mint);
            const last = house?.last || px[token.mint] || (["USDC", "USDT", "PYUSD"].includes(token.symbol) ? 1 : 0);
            return (
              <div className="mt-3 overflow-hidden rounded-2xl bg-black/30">
                <p className="px-3 pt-3 text-sm font-semibold">{token.symbol} · {last > 0 ? formatUsd(token.ui * last) : "no mark"}</p>
                <LiveChart compact mint={token.mint} symbol={token.symbol} live={last} />
              </div>
            );
          })()}
          <ul className="mt-2">
            {chain.tokens
              .filter((token) => token.ui > 0)
              .map((token) => {
                const house = names.find((name) => name.mint === token.mint);
                const last = house?.last || px[token.mint] || (["USDC", "USDT", "PYUSD"].includes(token.symbol) ? 1 : 0);
                const value = token.ui * last;
                return (
                  <li key={token.mint} className="flex items-center justify-between gap-3 border-t border-white/10 py-3">
                    <button type="button" onClick={() => setOpenMint(token.mint)} className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold">{token.symbol}</span>
                      <span className="block text-[11px] text-white/40">{tokenQty(token.ui)}{last > 0 ? ` · ${formatUsd(last)}` : ""}</span>
                    </button>
                    <span className="text-right">
                      <span className="block font-mono text-sm tabular-nums">{value > 0 ? formatUsd(value) : "—"}</span>
                      <Link to="/invest" search={{ desk: house?.venue === "prestocks" ? "pre" : "tape" }} className="text-[11px] font-semibold text-[#d7e36a]">
                        Trade
                      </Link>
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 lg:p-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Names</p>
            <p className="mt-1 text-xs text-white/40">
              {waiting
                ? "Reading the wallet…"
                : owner
                  ? `${owner.slice(0, 4)}…${owner.slice(-4)}${rows.length ? ` · ${rows.length} name${rows.length === 1 ? "" : "s"}` : ""}`
                  : "No wallet connected."}
            </p>
          </div>
          <p className="font-mono text-2xl tabular-nums">{waiting ? "—" : bookUsd(total)}</p>
        </div>
        {chain && (chain.sol > 0 || chain.tokens.some((t) => t.ui > 0)) ? (
          <ul className="mt-4 flex gap-2 overflow-x-auto">
            {chain.sol > 0 ? (
              <li className="shrink-0 rounded-full bg-black/40 px-3 py-2 font-mono text-xs">SOL {chain.sol >= 1 ? chain.sol.toFixed(3) : chain.sol.toFixed(4)}</li>
            ) : null}
            {chain.tokens.filter((t) => t.ui > 0).map((t) => (
              <li key={t.mint} className="shrink-0 rounded-full bg-black/40 px-3 py-2 font-mono text-xs">
                {t.symbol} {t.ui >= 1 ? t.ui.toFixed(2) : t.ui.toFixed(4)}
              </li>
            ))}
          </ul>
        ) : null}
        <BookView
          tokens={chain?.tokens ?? []}
          names={names}
          marks={(chain?.tokens ?? [])
            .filter((token) => token.ui > 0 && (px[token.mint] || 0) > 0)
            .map((token) => ({ mint: token.mint, symbol: token.symbol, last: px[token.mint] || 0 }))}
        />
        <div className="mt-4">
          <ActivityTape />
        </div>

        {!waiting && rows.length === 0 ? (
          <div className="mt-6">
            <p className="text-sm text-muted">{owner ? "This wallet holds no PreStocks." : "Connect a wallet. The book stays empty until it does."}</p>
            <Link to="/pre" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
              Open PreStocks
            </Link>
          </div>
        ) : null}

        {!waiting && rows.length > 0 ? (
          <ul className="mt-6 space-y-2 lg:hidden">
            {rows.map((row) => (
              <li key={row.mint} className="rounded-[22px] bg-black/30 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold">{row.symbol}</span>
                    <span className="block text-[11px] text-white/45">{tokenQty(row.tokens)} · last {formatUsd(row.last)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-sm">{row.value > 0 ? formatUsd(row.value) : "$0.00"}</span>
                    <span className={cn("font-mono text-xs", row.premium != null && row.premium < 0 ? "text-up" : "text-down")}>{formatPremium(row.premium)}</span>
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={sellUsd[row.mint] ?? (spendable(row.tokens, row.last) > 0 ? spendable(row.tokens, row.last).toFixed(2) : "")}
                    onChange={(e) => setSellUsd((cur) => ({ ...cur, [row.mint]: e.target.value }))}
                    inputMode="decimal"
                    aria-label={`Dollars of ${row.symbol} to sell`}
                    className="min-h-11 flex-1 rounded-full border border-white/10 bg-black/40 px-3 text-right font-mono text-sm outline-none"
                  />
                  <button
                    type="button"
                    disabled={Boolean(selling) || !(dollarsOf(row) > 0)}
                    onClick={() => void sellHolding(row)}
                    className="min-h-11 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg active:scale-95 disabled:opacity-40"
                  >
                    {selling === row.mint ? "…" : "Sell"}
                  </button>
                </div>
                <Link to="/invest" search={{ desk: "pre" }} className="mt-2 inline-block text-xs font-semibold text-[#d7e36a]">Open in Trade</Link>
              </li>
            ))}
          </ul>
        ) : null}
        {!waiting && rows.length > 0 ? (
          <div className="mt-6 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr className="text-[11px] tracking-[0.14em] text-subtle uppercase">
                  <th className="pb-2 font-normal">Symbol</th>
                  <th className="pb-2 text-right font-normal">Tokens</th>
                  <th className="pb-2 text-right font-normal">Last</th>
                  <th className="pb-2 text-right font-normal">Value</th>
                  <th className="pb-2 text-right font-normal">Premium</th>
                  <th className="pb-2 text-right font-normal">Sell</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const logo = logoSrc(row.symbol);
                  return (
                    <tr key={row.mint} className="border-t border-white/[0.06]">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {logo ? (
                            <img src={logo} alt="" className="size-9 rounded-full bg-white object-contain p-1" />
                          ) : (
                            <span className="grid size-9 place-items-center rounded-full bg-black/40 font-mono text-[10px]">{row.symbol.slice(0, 2)}</span>
                          )}
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{row.symbol}</span>
                            <span className="block truncate text-[11px] text-subtle">{row.name}</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-sm tabular-nums">{tokenQty(row.tokens)}</td>
                      <td className="py-3 text-right font-mono text-sm tabular-nums">{formatUsd(row.last)}</td>
                      <td className="py-3 text-right font-mono text-sm tabular-nums">{row.value > 0 ? formatUsd(row.value) : "$0.00"}</td>
                      <td className="py-3 text-right font-mono text-sm tabular-nums">
                        <span
                          className={cn(
                            row.premium == null ? "text-muted" : row.premium < 0 ? "text-up" : "text-down",
                          )}
                        >
                          {formatPremium(row.premium)}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            value={sellUsd[row.mint] ?? (spendable(row.tokens, row.last) > 0 ? spendable(row.tokens, row.last).toFixed(2) : "")}
                            onChange={(e) => setSellUsd((cur) => ({ ...cur, [row.mint]: e.target.value }))}
                            inputMode="decimal"
                            aria-label={`Dollars of ${row.symbol} to sell`}
                            className="min-h-9 w-24 rounded-full border border-white/10 bg-black/40 px-3 text-right font-mono text-xs tabular-nums outline-none"
                          />
                          <button
                            type="button"
                            disabled={Boolean(selling) || !(dollarsOf(row) > 0)}
                            onClick={() => void sellHolding(row)}
                            className="min-h-9 shrink-0 rounded-full bg-accent px-3 text-xs font-semibold whitespace-nowrap text-accent-fg disabled:opacity-40"
                          >
                            {selling === row.mint ? "Waiting for the wallet…" : `Sell $${dollarsOf(row).toFixed(2)}`}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {chain && chain.tokens.some((t) => t.ui > 0 && !rows.some((r) => r.mint === t.mint)) ? (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Also in Phantom</p>
            <Link to="/invest" search={{ desk: "spot" }} className="text-xs font-semibold text-[#d7e36a]">Trade</Link>
          </div>
          <ul className="mt-2 divide-y divide-white/10">
            {chain.tokens
              .filter((t) => t.ui > 0 && !rows.some((r) => r.mint === t.mint))
              .map((t) => (
                <li key={t.mint} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-semibold">{t.symbol}</span>
                  <span className="font-mono tabular-nums">{t.ui >= 1 ? t.ui.toFixed(4) : t.ui.toFixed(6)}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-2xl tracking-tight">Cash sleeve</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          A wrap is a claim on USDC that never leaves Phantom. Push sends the claim back. Agents can only send inside the cap.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl bg-black/30 px-4 py-4">
            <p className="text-xs text-subtle">On-chain USDC</p>
            <p className="mt-1 font-mono text-3xl">{owner ? `$${usdc.toFixed(2)}` : "—"}</p>
            <p className="mt-2 text-xs text-muted">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "No wallet connected."}</p>
          </div>
          <div className="rounded-2xl bg-black/30 px-4 py-4">
            <p className="text-xs text-subtle">Wrapped</p>
            <p className="mt-1 font-mono text-3xl text-accent">${wrapped.toFixed(2)}</p>
            <p className="mt-2 text-xs text-muted">Still sitting in the wallet. Counted once.</p>
          </div>
          <div className="rounded-2xl bg-black/30 px-4 py-4">
            <p className="text-xs text-subtle">Send cap</p>
            <p className="mt-1 font-mono text-3xl">${cap}</p>
            <div className="mt-3 flex gap-1">
              {[25, 100, 500].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCap(setSpendCap(n))}
                  className={cn("min-h-9 rounded-full px-3 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}
                >
                  ${n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-white/[0.06] pt-4">
          <div>
            <p className="text-xs text-subtle">Wrapped in Phantom</p>
            <p className="mt-1 font-mono text-4xl text-accent">${wrapped.toFixed(2)}</p>
            <p className="mt-2 text-sm text-muted">
              {owner ? `Phantom holds $${usdc.toFixed(2)} USDC. The wrap stays in that wallet.` : "Connect Phantom. The wrap never leaves it."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={wrapHeld} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
              Wrap what Phantom holds
            </button>
            <button type="button" onClick={sendBack} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">
              Send back to Phantom
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-xl">
          {owner ? (
            <>
              <input
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                inputMode="decimal"
                className="min-h-12 w-full rounded-full border border-white/10 bg-black/40 px-4 font-mono text-lg outline-none"
                aria-label="Amount"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => wrap()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
                  Wrap
                </button>
                <button type="button" onClick={() => push()} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold">
                  Push back
                </button>
                <Link to="/agents" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
                  Fund an agent inside the cap
                </Link>
              </div>
            </>
          ) : (
            <WalletPicker />
          )}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">How a PreStock swap is signed</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Jupiter builds it inside Senda. There is no trip out to the issuer.</li>
            <li>Only SOL, USDC, and the PreStock mints are allowed. Anything else never reaches the wallet.</li>
            <li>The chain simulates it first. If it would fail, Phantom is not asked.</li>
            <li>Impact over 5%, or a size over the cap, is refused.</li>
            <li>You sign. The key never comes here.</li>
          </ul>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">Cash vaults</h2>
          <p className="mt-1 text-sm text-muted">A named pocket of Senda cash. It is not a second wallet and it does not mint USDC.</p>
          <ul className="mt-3 space-y-2">
            {wallet.w.vaults.length === 0 ? <li className="rounded-[22px] bg-black/40 px-3 py-3 text-sm text-subtle">None yet.</li> : null}
            {wallet.w.vaults.map((v) => (
              <li key={v.id} className="flex items-baseline justify-between rounded-[22px] bg-black/40 px-3 py-3 text-sm">
                <span>{v.name}</span>
                <span className="font-mono tabular-nums">{formatMoney(v.balance, v.ccy)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none"
            />
            <select value={ccy} onChange={(e) => setCcy(e.target.value as Ccy)} className="min-h-11 rounded-full border border-white/10 bg-black/40 px-3 text-sm">
              {CCYS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const r = wallet.openVault(name, ccy);
                if (!r.ok) toast.error(r.error);
                else {
                  setName("");
                  toast.success("Vault opened.");
                }
              }}
              className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
            >
              Open
            </button>
          </div>
        </div>
      </section>

      <FilmBand poster="/images/orbit.jpg" label="The wallet stays the wallet." />
      </div>
      <div id="port-loans">
        <LendDesk house={names} />
      </div>
      <div id="port-savings">
        <SavingsLane
          owner={owner}
          sol={chain?.sol ?? 0}
          jito={chain?.tokens.find((t) => t.symbol === "JitoSOL" || t.mint === "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn")?.ui ?? 0}
          solPx={solPx}
        />
      </div>
    </main>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="text-white/45">{k}</span>
      <span className="font-mono tabular-nums">{v}</span>
    </p>
  );
}

const STABLES = new Set(["USDC", "USDT", "PYUSD", "EURC", "CASH"]);

function markOf(symbol: string, mint: string, ui: number, names: HouseListing[], px: Record<string, number>, chg: Record<string, number>): { usd: number | null; chg: number | null } {
  if (STABLES.has(symbol)) return { usd: ui, chg: null };
  const name = names.find((n) => n.mint === mint);
  const last = name && name.last > 0 ? name.last : px[mint] || 0;
  if (!(last > 0)) return { usd: null, chg: null };
  if (!name) return { usd: ui * last, chg: chg[mint] ?? null };
  const raw = name.change24h == null ? name.premium : name.change24h;
  const pct = raw == null ? chg[mint] ?? null : Math.abs(raw) <= 2 ? raw * 100 : raw;
  return { usd: ui * last, chg: pct };
}

function Allocation({
  chain,
  names,
  owner,
  usdc,
  history,
  px,
  chg,
  solPx,
}: {
  chain: ChainWallet;
  names: HouseListing[];
  owner: string;
  usdc: number;
  history: Array<{ day: string; usd: number }>;
  px: Record<string, number>;
  chg: Record<string, number>;
  solPx: number;
}) {
  const [win, setWin] = useState<"24H" | "7D" | "30D" | "ALL">("30D");
  const nameMints = new Set(names.filter((n) => n.venue === "prestocks").map((n) => n.mint));
  const rows = [
    ...(chain.sol > 0 ? [{ key: "SOL", symbol: "SOL", sub: solPx > 0 ? `${tokenQty(chain.sol)} SOL` : "Solana", ui: chain.sol, usd: solPx > 0 ? chain.sol * solPx : null, chg: chg[SOL_MINT] ?? null, klass: "Crypto" }] : []),
    ...chain.tokens.filter((t) => t.ui > 0).map((t) => {
      const marked = markOf(t.symbol, t.mint, t.ui, names, px, chg);
      const klass = STABLES.has(t.symbol) ? "Cash" : STAKED.has(t.symbol) ? "Staked" : nameMints.has(t.mint) ? "Names" : /x$/i.test(t.symbol) ? "Shares" : "Crypto";
      return { key: t.mint, symbol: t.symbol, sub: `${tokenQty(t.ui)} ${t.symbol}`, ui: t.ui, usd: marked.usd, chg: marked.chg, klass };
    }),
  ];
  const valued = rows.reduce((s, r) => s + (r.usd ?? 0), 0);
  const day = rows.reduce((s, r) => s + (r.usd != null && r.chg != null ? r.usd * (r.chg / 100) : 0), 0);
  const classes = ["Cash", "Crypto", "Names", "Shares", "Staked"].map((label) => ({
    label,
    usd: rows.filter((r) => r.klass === label).reduce((s, r) => s + (r.usd ?? 0), 0),
  })).filter((row) => row.usd > 0);
  const lots = lotsFrom(
    readFills(),
    chain.tokens.map((t) => ({ mint: t.mint, ui: t.ui })),
    rows.filter((r) => r.key !== "SOL" && r.usd != null && r.ui > 0).map((r) => ({ mint: r.key, symbol: r.symbol, last: r.usd! / r.ui })),
  );
  const cost = [...lots.hold, ...lots.trade].reduce((s, lot) => s + lot.cost, 0);
  const known = rows.filter((r) => r.usd != null).length;
  const barMax = Math.max(0.01, ...rows.map((r) => r.usd ?? 0));
  const take = win === "24H" ? 2 : win === "7D" ? 7 : win === "30D" ? 30 : history.length;
  const span = [...history].slice(0, Math.max(take, 0)).reverse();
  const pts = span.map((h) => h.usd);
  const first = span[0];
  const latest = span[span.length - 1];
  const drift = first && latest && span.length > 1 ? latest.usd - first.usd : null;
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#c6f56a]/20 bg-[#070b08] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/55">Marked</p>
          <p className="font-mono text-4xl tabular-nums">${valued.toFixed(2)}</p>
          <p className="text-xs text-white/45">{owner.slice(0, 4)}…{owner.slice(-4)} · {rows.length} held · {known} marked</p>
        </div>
        {drift != null ? <p className={cn("font-mono text-sm", drift < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{drift < 0 ? "−" : "+"}${Math.abs(drift).toFixed(2)}</p> : <p className={cn("font-mono text-sm", day < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{day === 0 ? "flat today" : `${day < 0 ? "−" : "+"}$${Math.abs(day).toFixed(2)} today`}</p>}
      </div>
      {classes.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {classes.map((row) => (
            <div key={row.label} className="rounded-2xl bg-black/40 px-3 py-2">
              <p className="text-[11px] text-white/45">{row.label}</p>
              <p className="font-mono text-sm tabular-nums">${row.usd >= 1 ? row.usd.toFixed(2) : row.usd.toFixed(4)}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#d7e36a]" style={{ width: `${Math.max(6, (row.usd / Math.max(valued, 0.01)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {cost > 0 ? (
        <p className="mt-3 text-xs text-white/50">
          {`Signed fills still open: cost $${cost.toFixed(2)} · mark $${(lots.holdValue + lots.tradeValue).toFixed(2)} · ${lots.pnl >= 0 ? "+" : "−"}$${Math.abs(lots.pnl).toFixed(2)}`}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        {(["24H", "7D", "30D", "ALL"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setWin(id)} className={cn("min-h-8 rounded-full px-3 text-[11px] font-semibold", win === id ? "bg-white text-black" : "bg-black/40 text-white/60")}>
            {id}
          </button>
        ))}
      </div>
      <Spark points={pts} down={drift != null && drift < 0} />
      <p className="text-[11px] text-white/35">Days this wallet was open. Nothing is filled in for days you were away. Not a candle history.</p>
      <ul className="mt-3">
        {rows.map((r) => (
          <li key={r.key} className="border-t border-white/10 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-black text-[10px] font-semibold">{r.symbol.slice(0, 3)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{r.symbol}</span>
                <span className="block truncate text-[11px] text-white/40">{r.sub}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm">{r.usd != null ? `$${r.usd >= 1 ? r.usd.toFixed(2) : r.usd.toFixed(4)}` : r.ui.toFixed(4)}</span>
                {r.chg != null ? <span className={cn("block font-mono text-xs", r.chg < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{r.chg >= 0 ? "+" : ""}{r.chg.toFixed(1)}%</span> : null}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#d7e36a]" style={{ width: `${r.usd != null ? Math.max(6, (r.usd / barMax) * 100) : 6}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-white/35">Marked value is USDC plus names with a live print. SOL stays a quantity until it has a dollar mark on this card. Cash on the book is ${usdc.toFixed(2)}.</p>
    </section>
  );
}
