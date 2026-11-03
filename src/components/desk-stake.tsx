import { useState } from "react";
import { toast } from "sonner";
import { LiveChart } from "@/components/price-chart";
import { noteAct } from "@/lib/book";
import { loadClearing } from "@/lib/clearing-key";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { formatValuation, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Side = "long" | "short" | "above" | "below";
type Row = { at: string; symbol: string; side: Side; usd: number; lev: number; signature: string; print: number };

const KEY = "senda.desk.contracts.v1";

function readRows(): Row[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Row[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeRows(rows: Row[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

/** USDC margin posted to the clearing address on this device. Phantom signs. No token comes back. */
export function DeskStake({
  names,
  mode,
}: {
  names: HouseListing[];
  mode: "perp" | "pred";
}) {
  const book = names.filter((n) => n.venue === "prestocks" && (n.valuation > 0 || n.last > 0)).slice(0, 12);
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [side, setSide] = useState<Side>(mode === "perp" ? "long" : "above");
  const [usd, setUsd] = useState(1);
  const [lev, setLev] = useState(1);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => readRows());
  const wallet = useWallet();
  const name = book.find((n) => n.symbol === symbol) ?? book[0];
  const sides: Side[] = mode === "perp" ? ["long", "short"] : ["above", "below"];

  async function post(nextSide: Side = side) {
    if (!name) return;
    if (!(usd >= 0.5)) {
      toast.error("The stake is $0.50 or more in USDC.");
      return;
    }
    setSide(nextSide);
    setBusy(true);
    try {
      const owner = await connectPhantom();
      wallet.linkChain(owner, "Phantom", "phantom");
      const clear = loadClearing();
      if (!clear.address) throw new Error("This browser would not keep a clearing address.");
      const memo = mode === "perp" ? `Senda clear perp ${name.symbol} ${nextSide} ${lev}x` : `Senda clear pred ${name.symbol} 1h ${nextSide}`;
      const done = await payUsdc({ owner, to: clear.address, usd, memo });
      const print = name.last > 0 ? name.last : name.valuation;
      const next = [{ at: new Date().toISOString(), symbol: name.symbol, side: nextSide, usd, lev, signature: done.signature, print }, ...readRows()];
      writeRows(next);
      setRows(next);
      noteAct({ kind: "send", title: `${name.symbol} ${side}`, detail: `$${usd} USDC`, signature: done.signature });
      toast.success(`Posted $${usd.toFixed(2)}. ${done.signature.slice(0, 8)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The margin did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">{mode === "perp" ? "Pre-launch futures" : "Predict"}</p>
      <h2 className="mt-1 text-2xl tracking-tight">{mode === "perp" ? "Trade the valuation" : "Above or below the print"}</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        {mode === "perp"
          ? "Long or short the implied FDV. You post USDC. You do not receive a share. It sits at the clearing address on this device until you import that key and move it."
          : "Pick above or below. Sign in Phantom. USDC leaves your wallet for the clearing address on this device."}
      </p>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {book.map((n) => (
          <button
            key={n.mint}
            type="button"
            onClick={() => setSymbol(n.symbol)}
            className={cn("min-h-12 shrink-0 rounded-2xl border px-3 text-left", name?.symbol === n.symbol ? "border-accent" : "border-white/10")}
          >
            <span className="block text-xs font-semibold">{n.symbol}</span>
            <span className="font-mono text-[11px] text-subtle">{n.valuation > 0 ? formatValuation(n.valuation) : ""}</span>
          </button>
        ))}
      </div>
      {name ? (
        <div className="mt-3">
          <LiveChart
            mint={name.mint}
            symbol={name.symbol}
            live={name.last}
            trade={{
              amount: String(usd),
              setAmount: (value) => {
                const n = Number(value);
                if (n > 0) setUsd(n);
              },
              busy,
              quote: mode === "perp" ? `${side} ${lev}× · USDC margin` : `${side} the print · USDC`,
              position: rows.some((row) => row.symbol === name.symbol) ? "Ticket open on this wallet" : "No open ticket",
              onBuy: () => void post(mode === "perp" ? "long" : "above"),
              onSell: () => void post(mode === "perp" ? "short" : "below"),
              buyLabel: mode === "perp" ? "Long" : "Above",
              sellLabel: mode === "perp" ? "Short" : "Below",
            }}
          />
        </div>
      ) : null}
      {mode === "perp" ? (
        <div className="mt-3 flex gap-2">
          {[1, 2, 4].map((n) => (
            <button key={n} type="button" onClick={() => setLev(n)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", lev === n ? "bg-white text-black" : "border border-white/10")}>
              {n}×
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        {[0.5, 1, 5, 10].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 flex-1 rounded-full font-mono text-sm", usd === n ? "bg-accent text-accent-fg" : "border border-white/10")}>
            ${n}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {sides.map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)} className={cn("min-h-12 rounded-full text-sm font-semibold capitalize", side === s ? "bg-white text-black" : "border border-white/10")}>
            {s}
          </button>
        ))}
      </div>
      <button type="button" disabled={busy || !name} onClick={() => void post()} className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50">
        {busy ? "Waiting for the wallet…" : `Post $${usd} ${name?.symbol ?? ""} ${side}`}
      </button>
      <div className="mt-4">
        <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Open on this wallet</p>
        {rows.filter((r) => (mode === "perp" ? r.side === "long" || r.side === "short" : r.side === "above" || r.side === "below")).length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing open. Post sends USDC from this wallet. Phantom has to sign.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {rows
              .filter((r) => (mode === "perp" ? r.side === "long" || r.side === "short" : r.side === "above" || r.side === "below"))
              .slice(0, 8)
              .map((r) => (
                <li key={r.signature} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-base font-semibold">
                      {r.symbol} · {r.side}
                      {mode === "perp" ? ` ${r.lev}×` : ""}
                    </p>
                    <p className="font-mono text-sm">${r.usd}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {mode === "perp"
                      ? `You posted $${r.usd} USDC as ${r.side} margin. The print you locked was ${r.print > 0 ? `$${r.print.toLocaleString("en-US")}` : "the live last"}.`
                      : `You paid $${r.usd} USDC that ${r.symbol} finishes ${r.side} ${r.print > 0 ? `$${r.print.toLocaleString("en-US")}` : "the print you locked"}. That USDC left this wallet. It is the ticket, not a new token in Phantom.`}
                  </p>
                  <a href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-xs text-accent">
                    {r.signature.slice(0, 8)}… on Solscan
                  </a>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}
