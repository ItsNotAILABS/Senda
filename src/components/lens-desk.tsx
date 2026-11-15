import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { MarkFace } from "@/components/holding-cards";
import { LiveChart } from "@/components/price-chart";
import { markHolds, SOL_MINT, type HoldMark } from "@/lib/hold-marks";
import { signStockSwap } from "@/lib/jup-sign";
import { readLens, type LensRead } from "@/lib/lens-read";
import { connectPhantom, pickOwner, PRESTOCK_MINTS, readChain, splHolding, type ChainToken } from "@/lib/phantom";
import { listTrades, onTrades, rememberTrade, type TradeFill } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const CASH = new Set(["USDC", "USDT", "CASH", "PYUSD", "USD1", "USDG", "USDS"]);
const SOL = SOL_MINT;

type Pos = {
  mint: string;
  symbol: string;
  ui: number;
  decimals: number;
  price: number;
  boughtUsd: number;
  soldUsd: number;
  boughtQty: number;
  soldQty: number;
  feesSol: number;
  lastAt: number;
  fills: number;
};

function usd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a === 0) return "$0";
  if (a >= 1000) return `${sign}$${a.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (a >= 1) return `${sign}$${a.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (a >= 0.01) return `${sign}$${a.toFixed(2)}`;
  return `${sign}$${a.toPrecision(2)}`;
}

function qty(n: number): string {
  if (!(n > 0)) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function short(s: string): string {
  if (s.length < 12) return s || "—";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function ago(ms: number): string {
  if (!(ms > 0)) return "—";
  const m = Math.floor(Math.max(0, Date.now() - ms) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ageOf(ms: number): string {
  if (!(ms > 0)) return "—";
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d < 1) return "today";
  if (d < 60) return `${d}d`;
  const mo = Math.floor(d / 30);
  return mo < 24 ? `${mo}mo` : `${Math.floor(mo / 12)}y`;
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function auditPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 0.01) return `${n.toFixed(2)}%`;
  return `${n.toPrecision(2)}%`;
}

function shareOf(n: number | null): string {
  if (n == null || !(n > 0)) return "—";
  if (n >= 0.01) return `${(n * 100).toFixed(2)}%`;
  return `${(n * 100).toFixed(4)}%`;
}

function fillsOf(mint: string, rows: TradeFill[]) {
  const out = { boughtUsd: 0, soldUsd: 0, boughtQty: 0, soldQty: 0, feesSol: 0, lastAt: 0, fills: 0 };
  for (const row of rows) {
    if (row.mint !== mint || (row.side !== "buy" && row.side !== "sell")) continue;
    out.fills += 1;
    out.lastAt = Math.max(out.lastAt, row.at || 0);
    out.feesSol += Number(row.solFee) || 0;
    if (row.side === "buy") {
      out.boughtUsd += Number(row.usd) || 0;
      out.boughtQty += Number(row.qty) || 0;
    } else {
      out.soldUsd += Number(row.usd) || 0;
      out.soldQty += Number(row.qty) || 0;
    }
  }
  return out;
}

function upnl(row: Pos): { usd: number; pct: number } | null {
  if (!(row.boughtQty > 0) || !(row.price > 0)) return null;
  const left = row.boughtQty - row.soldQty;
  if (!(left > 0)) return null;
  const slice = Math.min(row.ui, left);
  const avg = row.boughtUsd / row.boughtQty;
  if (!(avg > 0) || !(slice > 0)) return null;
  const pnl = (row.price - avg) * slice;
  return { usd: pnl, pct: ((row.price - avg) / avg) * 100 };
}

export function LensDesk() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const linked = pickOwner(wallet.w.links);
  const [live, setLive] = useState("");
  const owner = live || linked;
  const [tokens, setTokens] = useState<ChainToken[]>([]);
  const [sol, setSol] = useState(0);
  const [reading, setReading] = useState(false);
  const [fills, setFills] = useState<TradeFill[]>([]);
  const [hideCash, setHideCash] = useState(true);
  const [hideDust, setHideDust] = useState(false);
  const [mint, setMint] = useState("");
  const [lens, setLens] = useState<LensRead | null>(null);
  const [lensNote, setLensNote] = useState("");
  const [tab, setTab] = useState<"pools" | "largest" | "missing">("pools");
  const [share, setShare] = useState(false);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState("");
  const [marks, setMarks] = useState<Record<string, HoldMark>>({});

  useEffect(() => {
    const pull = () => setFills(listTrades());
    pull();
    return onTrades(pull);
  }, []);

  useEffect(() => {
    if (!owner) {
      setTokens([]);
      setSol(0);
      return;
    }
    let on = true;
    const pull = () => {
      setReading(true);
      readChain(owner)
        .then((snap) => {
          if (!on) return;
          setSol(snap.sol);
          setTokens(snap.tokens);
        })
        .catch(() => undefined)
        .finally(() => {
          if (on) setReading(false);
        });
    };
    pull();
    const id = window.setInterval(pull, 12_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    const ids = [SOL, ...tokens.map((token) => token.mint)].slice(0, 24);
    let on = true;
    markHolds({ data: ids })
      .then((got) => {
        if (on) setMarks(got);
      })
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [owner, tokens]);

  useEffect(() => {
    if (mint.length < 32) {
      setLens(null);
      setLensNote("");
      return;
    }
    let on = true;
    setLensNote("Reading the pool and the largest accounts…");
    readLens({ data: { mint } })
      .then((row) => {
        if (!on) return;
        setLens(row);
        setLensNote("");
      })
      .catch((e: unknown) => {
        if (!on) return;
        setLens(null);
        setLensNote(e instanceof Error ? e.message : "That mint did not load.");
      });
    return () => {
      on = false;
    };
  }, [mint]);

  const rows = useMemo(() => {
    const list: Pos[] = [];
    if (sol > 0) {
      list.push({
        mint: SOL,
        symbol: "SOL",
        ui: sol,
        decimals: 9,
        price: marks[SOL]?.usd || 0,
        ...fillsOf(SOL, fills),
      });
    }
    for (const token of tokens) {
      if (!(token.ui > 0)) continue;
      const marked = marks[token.mint];
      const fromLens = lens?.mint === token.mint ? lens.jupPrice || lens.pools[0]?.price || 0 : 0;
      list.push({
        mint: token.mint,
        symbol: marked?.symbol || token.symbol,
        ui: token.ui,
        decimals: token.decimals,
        price: marked?.usd || fromLens,
        ...fillsOf(token.mint, fills),
      });
    }
    return list.sort((a, b) => b.ui * (b.price || 0) - a.ui * (a.price || 0) || a.symbol.localeCompare(b.symbol));
  }, [sol, tokens, fills, lens, marks]);

  const shown = rows.filter((row) => {
    if (hideCash && CASH.has(row.symbol)) return false;
    if (hideDust && row.price > 0 && row.ui * row.price < 1) return false;
    return true;
  });

  const open = shown.find((row) => row.mint === mint) || null;
  const price = (mint && marks[mint]?.usd) || lens?.jupPrice || lens?.pools[0]?.price || open?.price || 0;
  const symbol = lens?.symbol || marks[mint]?.symbol || open?.symbol || (mint ? short(mint) : "");
  const move = lens?.jupChangePct ?? lens?.pools.find((pool) => pool.changePct != null)?.changePct ?? null;

  function pick(next: string) {
    setShare(false);
    setTab("pools");
    setMint(next);
  }

  function openHl() {
    void navigate({ href: "/invest?desk=hl" });
  }

  function openRamp() {
    void navigate({ href: "/payments/add" });
  }

  async function connect() {
    try {
      const addr = await connectPhantom();
      setLive(addr);
      toast.success(short(addr));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not connect.");
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Copy did not run in this browser.");
    }
  }

  async function sellAll(row: Pos) {
    if (!owner) {
      toast.error("Connect the wallet. Selling is a signature, not a button fill.");
      return;
    }
    if (row.mint === SOL) {
      toast.error("Selling native SOL is not this ticket. Swap it from the swap desk.");
      return;
    }
    setBusy(row.mint);
    try {
      const held = await splHolding(owner, row.mint);
      const raw = BigInt(held.raw || "0");
      if (raw <= 0n) throw new Error("This account holds none of that.");
      const size = Math.max(row.ui * (row.price || price || 0), 0.01);
      const done = await signStockSwap({
        owner,
        mint: row.mint,
        side: "sell",
        usd: size,
        decimals: held.decimals || row.decimals || 9,
        tokenAmount: raw,
      });
      rememberTrade({
        symbol: row.symbol,
        side: "sell",
        usd: size,
        mint: row.mint,
        qty: row.ui,
        signature: done.signature,
      });
      toast.success(`Wallet signed the sell of ${row.symbol}.`);
      const again = await readChain(owner);
      setSol(again.sol);
      setTokens(again.tokens);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sell did not sign.");
    } finally {
      setBusy("");
    }
  }

  function submitPaste(e: FormEvent) {
    e.preventDefault();
    const next = paste.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(next)) {
      toast.error("That is not a Solana mint.");
      return;
    }
    pick(next);
  }

  return (
    <main className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Position</p>
        <h1 className="text-3xl tracking-tight">What this wallet holds</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Balances are the chain. Bought, sold, and fees are fills this browser signed. A blank cost is unknown, not zero. Early buyers, a dev wallet, migration percent, bundles, honeypots, and other people’s chart marks are not on this book.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-xs text-subtle">{owner ? short(owner) : "No wallet"}{reading ? " · reading" : ""}{sol > 0 ? ` · ${sol.toFixed(4)} SOL` : ""}</p>
        {owner ? null : (
          <button type="button" onClick={() => void connect()} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black">
            Connect wallet
          </button>
        )}
        <button type="button" onClick={openHl} className="min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">
          Leverage book
        </button>
        <button type="button" onClick={openRamp} className="min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">
          Card on-ramp
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={() => setHideCash((v) => !v)} className={cn("min-h-9 rounded-full border px-3", hideCash ? "border-white bg-white text-black" : "border-white/15")}>
          Hide cash
        </button>
        <button type="button" onClick={() => setHideDust((v) => !v)} className={cn("min-h-9 rounded-full border px-3", hideDust ? "border-white bg-white text-black" : "border-white/15")}>
          Hide under $1
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] text-subtle">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 font-medium">Token</th>
                <th className="px-3 py-2 font-medium">Last fill</th>
                <th className="px-3 py-2 font-medium">Bought</th>
                <th className="px-3 py-2 font-medium">Sold</th>
                <th className="px-3 py-2 font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">UPnL</th>
                <th className="px-3 py-2 font-medium">Fees</th>
                <th className="px-3 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-sm text-muted">
                    {owner ? "Nothing in this wallet matches the filters." : "Connect the wallet. This table does not invent a position."}
                  </td>
                </tr>
              ) : null}
              {shown.map((row) => {
                const pnl = upnl(row);
                const value = row.price > 0 ? row.ui * row.price : 0;
                const on = mint === row.mint;
                return (
                  <tr key={row.mint} className={cn("border-b border-white/[0.06]", on && "bg-white/[0.04]")}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => pick(row.mint)} className="text-left">
                        <span className="block font-semibold">{row.symbol}</span>
                        <span className="block font-mono text-[11px] text-subtle">{short(row.mint)}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.fills ? ago(row.lastAt) : "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.fills ? usd(row.boughtUsd) : "—"}
                      <span className="block text-subtle">{row.boughtQty > 0 ? qty(row.boughtQty) : row.fills ? "qty not stored" : ""}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.fills ? usd(row.soldUsd) : "—"}
                      <span className="block text-subtle">{row.soldQty > 0 ? qty(row.soldQty) : ""}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {value > 0 ? usd(value) : "no mark"}
                      <span className="block text-subtle">{qty(row.ui)}</span>
                    </td>
                    <td className={cn("px-3 py-2 font-mono text-xs", pnl == null ? "text-subtle" : pnl.usd < 0 ? "text-down" : "text-up")}>
                      {pnl ? `${usd(pnl.usd)} (${pct(pnl.pct)})` : "unknown"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.feesSol > 0 ? `${row.feesSol.toFixed(6)} SOL` : "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={busy === row.mint || row.mint === SOL}
                        onClick={() => void sellAll(row)}
                        className="min-h-9 rounded-full bg-down px-3 text-xs font-semibold text-down-fg disabled:opacity-40"
                      >
                        {busy === row.mint ? "Signing…" : "Sell 100%"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-3 py-2 text-[11px] text-subtle">UPnL uses a quantity this browser stored on a buy. Fees show only when that fill recorded the SOL fee. Sell 100% asks the wallet to swap the whole balance to USDC.</p>
      </section>

      <section>
        <p className="text-sm font-semibold">Open a mint</p>
        <p className="mt-1 text-xs text-muted">These names already trade on the book. The price below is the pool, not a pasted number.</p>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {PRESTOCK_MINTS.map(([name, id]) => (
            <button key={id} type="button" onClick={() => pick(id)} className={cn("min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold", mint === id ? "border-white bg-white text-black" : "border-white/15")}>
              {name}
            </button>
          ))}
        </div>
        <form onSubmit={submitPaste} className="mt-2 flex gap-2">
          <input
            value={paste}
            onChange={(e) => setPaste(e.target.value.trim())}
            placeholder="Paste a Solana mint"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-sm"
          />
          <button type="submit" className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">
            Open
          </button>
        </form>
      </section>

      {mint ? (
        <section className="space-y-3 rounded-2xl border border-white/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <MarkFace icon={lens?.icon} symbol={symbol || "?"} mint={mint} size={40} />
              <div>
                <h2 className="text-2xl tracking-tight">{symbol || "Mint"}</h2>
                <p className="font-mono text-[11px] text-subtle">{short(mint)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl tabular-nums">{price > 0 ? usd(price) : "—"}</p>
              <p className={cn("font-mono text-xs", move == null ? "text-subtle" : move < 0 ? "text-down" : "text-up")}>{move == null ? "24h not reported" : pct(move)}</p>
              <p className="font-mono text-[11px] text-subtle">{lens?.jupPrice ? "Jupiter last" : "Deepest pool"}</p>
              <button type="button" onClick={() => setShare((v) => !v)} className="mt-1 text-xs font-semibold text-accent">
                Share
              </button>
            </div>
          </div>
          {lens?.name ? <p className="text-xs text-muted">{lens.name}{lens.supply ? ` · supply ${qty(lens.supply)}` : ""}{lens.holders ? ` · Jupiter holders ${lens.holders.toLocaleString("en-US")}` : ""}</p> : null}
          {lens?.dev ? (
            <p className="text-xs text-muted">
              Dev {short(lens.dev)}
              {lens.devMints != null ? ` · Jupiter lists ${lens.devMints} mints from this dev` : ""}
              {lens.devBalPct != null ? ` · dev balance ${auditPct(lens.devBalPct)}` : ""}
              . Not a funding trace, and not a migration rate.
            </p>
          ) : null}
          {lensNote ? <p className="text-sm text-muted">{lensNote}</p> : null}
          {share ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy(mint, "Mint copied")} className="min-h-11 rounded-full border border-white/15 px-4 text-sm">Copy mint</button>
              <button type="button" onClick={() => void copy(`https://solscan.io/token/${mint}`, "Solscan link copied")} className="min-h-11 rounded-full border border-white/15 px-4 text-sm">Solscan</button>
              <button type="button" onClick={() => void copy(`https://dexscreener.com/solana/${mint}`, "Pool link copied")} className="min-h-11 rounded-full border border-white/15 px-4 text-sm">Dexscreener</button>
            </div>
          ) : null}
          <LiveChart compact mint={mint} symbol={symbol || "Mint"} live={price || undefined} />
          <div className="flex gap-1 overflow-x-auto">
            {([
              ["pools", "Pools"],
              ["largest", "Largest accounts"],
              ["missing", "Not on this book"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold", tab === id ? "bg-white text-black" : "bg-white/10")}>
                {label}
              </button>
            ))}
          </div>
          {tab === "pools" ? (
            <div className="overflow-x-auto">
              {lens?.poolNote ? <p className="text-sm text-muted">{lens.poolNote}</p> : null}
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-[11px] text-subtle">
                  <tr>
                    <th className="py-2 font-medium">Pool</th>
                    <th className="py-2 font-medium">Price</th>
                    <th className="py-2 font-medium">Liquidity</th>
                    <th className="py-2 font-medium">24h volume</th>
                    <th className="py-2 font-medium">FDV</th>
                    <th className="py-2 font-medium">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {(lens?.pools || []).map((pool, i) => (
                    <tr key={`${pool.dex}-${pool.url}-${i}`} className="border-t border-white/[0.06]">
                      <td className="py-2">{pool.dex}</td>
                      <td className="py-2 font-mono text-xs">{pool.price > 0 ? usd(pool.price) : "—"}</td>
                      <td className="py-2 font-mono text-xs">{pool.liq > 0 ? usd(pool.liq) : "—"}</td>
                      <td className="py-2 font-mono text-xs">{pool.vol > 0 ? usd(pool.vol) : "—"}</td>
                      <td className="py-2 font-mono text-xs">{pool.fdv > 0 ? usd(pool.fdv) : "—"}</td>
                      <td className="py-2 font-mono text-xs">{ageOf(pool.created)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {tab === "largest" ? (
            <div>
              <p className="text-xs text-muted">Largest token accounts on this mint. The owner is the wallet when the chain returns it. This is not a holder count, not top traders, and not early buyers.</p>
              {lens?.accountNote ? <p className="mt-2 text-sm text-muted">{lens.accountNote.replace(/\.$/, "")}.{lens.topHoldersPct != null ? ` Jupiter still reports the largest holders together at ${auditPct(lens.topHoldersPct)} of supply. That is not an account list.` : ""}</p> : null}
              <ul className="mt-2 divide-y divide-white/[0.06]">
                {(lens?.accounts || []).map((row, i) => (
                  <li key={row.account} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-mono text-xs text-subtle">{i + 1}</span>{" "}
                      <span className="font-semibold">{row.owner ? short(row.owner) : short(row.account)}</span>
                      <span className="block font-mono text-[11px] text-subtle">{row.owner ? `account ${short(row.account)}` : "owner not returned"}</span>
                    </span>
                    <span className="text-right font-mono text-xs">
                      {qty(row.ui)}
                      <span className="block text-subtle">{shareOf(row.share)} of supply</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {tab === "missing" ? (
            <ul className="space-y-2 text-sm text-muted">
              <li>Early buyers. Not indexed.</li>
              <li>Dev wallet, funding wallet, migrated percent, best token, last launch. Not indexed.</li>
              <li>Bundle percent and honeypot. Not tested. A thin pool is just low liquidity in the table above.</li>
              <li>Copy-trade and other people’s buys drawn on the chart. Not on this book.</li>
              <li>Apple Pay is not a charge here. A card buy is the on-ramp, and it fails closed without its key.</li>
              <li>
                Leverage with live volume, funding, and open interest is the{" "}
                <Link to="/invest" search={{ desk: "hl" }} className="text-accent">
                  Hyperliquid book
                </Link>
                . This page does not copy those numbers.
              </li>
            </ul>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
