import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { dropFdv, fdvPnl, listFdv, saveFdv, type FdvPos } from "@/lib/fdv-book";
import { guardRoute } from "@/lib/route-guard";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { useHouse } from "@/lib/use-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { jupTape, type TapeRow } from "@/lib/world-book";
import { cn } from "@/lib/utils";

type Kind = "pre" | "x" | "coin";
type Row = { mint: string; symbol: string; name: string; price: number; fdv: number; kind: Kind };

const LEV: Record<Kind, number[]> = { pre: [1, 2, 3], x: [1, 2, 3, 5], coin: [1, 2, 3, 5] };

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
}

function fdvLabel(n: number) {
  if (!(n > 0)) return "";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T FDV`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B FDV`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M FDV`;
  return `${money(n)} FDV`;
}

export function FdvDesk() {
  const house = useHouse();
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [lens, setLens] = useState<Kind | "all">("pre");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [margin, setMargin] = useState(5);
  const [lev, setLev] = useState(1);
  const [side, setSide] = useState<"long" | "short">("long");
  const [busy, setBusy] = useState("");
  const [quote, setQuote] = useState("");
  const [positions, setPositions] = useState<FdvPos[]>([]);
  const [cap, setCap] = useState(40);

  useEffect(() => {
    let live = true;
    jupTape()
      .then((rows) => live && setTape(rows))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const pull = () => setPositions(listFdv(owner || undefined));
    pull();
    window.addEventListener("senda-fdv", pull);
    return () => window.removeEventListener("senda-fdv", pull);
  }, [owner]);

  const book = useMemo(() => {
    const rows: Row[] = [];
    const seen = new Set<string>();
    for (const h of house) {
      if (!h.mint || h.mint.length < 32 || seen.has(h.mint)) continue;
      if (!(h.last > 0)) continue;
      seen.add(h.mint);
      rows.push({
        mint: h.mint,
        symbol: h.symbol,
        name: h.name,
        price: h.last,
        fdv: h.valuation > 0 ? h.valuation : 0,
        kind: "pre",
      });
    }
    for (const t of tape) {
      if (!t.id || t.id.length < 32 || seen.has(t.id) || !(t.price && t.price > 0)) continue;
      seen.add(t.id);
      const kind: Kind = t.id.startsWith("Xs") ? "x" : "coin";
      rows.push({ mint: t.id, symbol: t.symbol, name: t.name, price: t.price, fdv: 0, kind });
    }
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (lens !== "all" && r.kind !== lens) return false;
      if (!query) return true;
      return `${r.symbol} ${r.name}`.toLowerCase().includes(query);
    });
  }, [house, tape, lens, q]);

  const row = book.find((r) => r.mint === pick) ?? book[0] ?? null;
  const steps = row ? LEV[row.kind] : [1];
  const usedLev = steps.includes(lev) ? lev : 1;
  const notional = Math.round(margin * usedLev * 100) / 100;
  const shown = book.slice(0, cap);

  useEffect(() => {
    if (!row || !(notional >= 1)) {
      setQuote("");
      return;
    }
    let live = true;
    const id = window.setTimeout(() => {
      guardRoute({ mint: row.mint, side: side === "long" ? "buy" : "sell", usd: notional, price: row.price, symbol: row.symbol })
        .then((p) => live && setQuote(p.line))
        .catch(() => live && setQuote(""));
    }, 320);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [row, notional, side]);

  async function open() {
    if (!row) return;
    if (!(notional >= 1)) return toast.error("Notional has to be at least $1.");
    setBusy("open");
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const kept = wallet.linkChain(who, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const preview = await guardRoute({ mint: row.mint, side: side === "long" ? "buy" : "sell", usd: notional, price: row.price, symbol: row.symbol });
      const done = await runPrestock({
        owner: who,
        mint: row.mint,
        side: side === "long" ? "buy" : "sell",
        usd: notional,
        price: row.price,
        symbol: row.symbol,
        desk: "futures",
      });
      saveFdv({
        owner: who,
        mint: row.mint,
        symbol: row.symbol,
        kind: row.kind,
        side,
        margin,
        lev: usedLev,
        notional,
        entry: row.price,
        fdvEntry: row.fdv,
        sig: done.signature,
      });
      toast.success(`${side === "long" ? "Long" : "Short"} ${row.symbol} $${notional}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The margin did not send.");
    } finally {
      setBusy("");
    }
  }

  async function close(pos: FdvPos) {
    const mark = book.find((r) => r.mint === pos.mint)?.price ?? pos.entry;
    setBusy(pos.id);
    try {
      const who = pos.owner || owner || (await connectPhantom());
      const done = await runPrestock({
        owner: who,
        mint: pos.mint,
        side: pos.side === "long" ? "sell" : "buy",
        usd: pos.notional,
        price: mark,
        symbol: pos.symbol,
        desk: "futures",
      });
      dropFdv(pos.id);
      const pnl = fdvPnl(pos, mark);
      toast.success(`Closed ${pos.symbol}${pnl == null ? "" : ` · ${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">USDC margin</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Trade the mark</h2>
      <p className="mt-2 text-sm text-white/55">
        You post USDC. Jupiter spends the full notional, so the token lands in your wallet. Leverage here is size, not a loan. A pre-IPO name is marked at its token price. The FDV is the valuation next to it.
      </p>
      <div className="mt-3 flex gap-2">
        {(["pre", "x", "coin", "all"] as const).map((id) => (
          <button key={id} type="button" onClick={() => { setLens(id); setCap(40); }} className={cn("min-h-9 rounded-full px-3 text-sm font-semibold", lens === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {id === "pre" ? "Pre-IPO" : id === "x" ? "xStocks" : id === "coin" ? "Coins" : "All"}
          </button>
        ))}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setCap(40); }} placeholder="Search a name, an xStock, a coin" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      {row ? (
        <div className="mt-3 rounded-[22px] bg-[#141418] p-4">
          <p className="text-sm text-white/50">{row.name}</p>
          <p className="font-mono text-3xl">{money(row.price)}</p>
          {row.fdv > 0 ? <p className="text-sm text-white/45">{fdvLabel(row.fdv)} implied. The contract follows the token.</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 5, 25, 100].map((n) => (
              <button key={n} type="button" onClick={() => setMargin(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-sm", margin === n ? "bg-white text-black" : "bg-black/40")}>
                ${n}
              </button>
            ))}
            <input value={String(margin)} onChange={(e) => setMargin(Number(e.target.value) || 0)} inputMode="decimal" className="min-h-9 w-24 rounded-full bg-black/40 px-3 font-mono text-sm outline-none" />
          </div>
          <div className="mt-3 flex gap-2">
            {steps.map((n) => (
              <button key={n} type="button" onClick={() => setLev(n)} className={cn("min-h-9 rounded-full px-3 text-sm", usedLev === n ? "bg-white text-black" : "bg-black/40")}>
                {n}×
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-white/55">
            Margin ${margin.toFixed(2)} · notional ${notional.toFixed(2)} · a 1% move is ${(notional * 0.01).toFixed(2)}
          </p>
          {quote ? <p className="mt-1 text-sm text-[#c6f56a]">{quote}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSide("long")} className={cn("min-h-12 rounded-2xl text-sm font-semibold", side === "long" ? "bg-[#c6f56a] text-black" : "bg-black/40")}>
              Long
            </button>
            <button type="button" onClick={() => setSide("short")} className={cn("min-h-12 rounded-2xl text-sm font-semibold", side === "short" ? "bg-[#ff5d73] text-white" : "bg-black/40")}>
              Short
            </button>
          </div>
          <button type="button" disabled={busy === "open"} onClick={() => void open()} className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-50">
            {busy === "open" ? "Waiting on Phantom…" : `${side === "long" ? "Buy" : "Sell"} $${notional.toFixed(2)} ${row.symbol}`}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-white/45">Nothing in this list has a live price yet.</p>
      )}
      <ul className="mt-3 divide-y divide-white/10">
        {shown.map((r) => (
          <li key={r.mint}>
            <button type="button" onClick={() => setPick(r.mint)} className="flex w-full items-center gap-3 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.symbol}</span>
                <span className="block truncate text-xs text-white/45">{r.kind === "pre" ? "Pre-IPO" : r.kind === "x" ? "xStock" : "Coin"} · {r.name}</span>
              </span>
              <span className="text-right font-mono text-xs">
                <span className="block">{money(r.price)}</span>
                <span className="block text-white/40">{fdvLabel(r.fdv)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {book.length > shown.length ? (
        <button type="button" onClick={() => setCap((n) => n + 80)} className="mt-2 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
          Show more · {book.length - shown.length} left
        </button>
      ) : null}
      <div className="mt-4">
        <p className="text-sm font-semibold">Open margin</p>
        {positions.length === 0 ? <p className="mt-1 text-sm text-white/45">None yet. A fill shows up here, marked to the live token price.</p> : null}
        <ul className="mt-2 space-y-2">
          {positions.map((pos) => {
            const mark = book.find((r) => r.mint === pos.mint)?.price ?? pos.entry;
            const pnl = fdvPnl(pos, mark);
            return (
              <li key={pos.id} className="rounded-2xl bg-[#141418] p-3">
                <p className="text-sm font-semibold">
                  {pos.side === "long" ? "Long" : "Short"} {pos.symbol} · ${pos.notional.toFixed(2)}
                </p>
                <p className="mt-1 font-mono text-xs text-white/55">
                  Entry {money(pos.entry)} · mark {money(mark)}
                  {pos.fdvEntry > 0 ? ` · opened at ${fdvLabel(pos.fdvEntry)}` : ""}
                </p>
                <p className={cn("mt-1 font-mono text-sm", (pnl ?? 0) >= 0 ? "text-[#c6f56a]" : "text-[#ff8d9a]")}>
                  {pnl == null ? "—" : `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`}
                </p>
                <button type="button" disabled={busy === pos.id} onClick={() => void close(pos)} className="mt-2 min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-50">
                  {busy === pos.id ? "Waiting on Phantom…" : "Close"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function MarginBook() {
  const wallet = useWallet();
  const house = useHouse();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<FdvPos[]>([]);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const pull = () => setRows(listFdv(owner || undefined));
    pull();
    window.addEventListener("senda-fdv", pull);
    return () => window.removeEventListener("senda-fdv", pull);
  }, [owner]);
  if (!owner || rows.length === 0) return null;
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-sm font-semibold">USDC margin</p>
      <ul className="mt-2 space-y-2">
        {rows.map((pos) => {
          const mark = house.find((h) => h.mint === pos.mint)?.last ?? pos.entry;
          const pnl = fdvPnl(pos, mark);
          return (
            <li key={pos.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{pos.side === "long" ? "Long" : "Short"} {pos.symbol}</span>
                <span className="block font-mono text-xs text-white/50">${pos.notional.toFixed(2)} · {pnl == null ? "—" : `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`}</span>
              </span>
              <button
                type="button"
                disabled={busy === pos.id}
                onClick={() => {
                  setBusy(pos.id);
                  void runPrestock({
                    owner: pos.owner,
                    mint: pos.mint,
                    side: pos.side === "long" ? "sell" : "buy",
                    usd: pos.notional,
                    price: mark,
                    symbol: pos.symbol,
                    desk: "futures",
                  })
                    .then((done) => {
                      dropFdv(pos.id);
                      toast.success(`Closed ${pos.symbol}. ${done.signature.slice(0, 8)}…`);
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : "The close did not send."))
                    .finally(() => setBusy(""));
                }}
                className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-50"
              >
                {busy === pos.id ? "…" : "Close"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
