import { useEffect, useState } from "react";
import { type TradeFill } from "@/lib/trade-log";

/** Full confirmation after a signature. It stays until it is closed. */
export function FillPaint() {
  const [fill, setFill] = useState<TradeFill | null>(null);
  useEffect(() => {
    return onTradesFromDetail(setFill);
  }, []);
  if (!fill) return null;
  const verb = fill.side === "sell" ? "Sold" : fill.side === "send" ? "Sent" : "Bought";
  const when = new Date(fill.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const qty = fill.qty && fill.qty > 0 ? fill.qty.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "";
  const paid = fill.paidUi && fill.paidUi > 0 ? `${amount(fill.paidUi, fill.paidAsset || "USDC")}` : `$${fill.usd.toFixed(2)}`;
  const got = qty ? `${qty} ${fill.receivedAsset || fill.symbol}` : fill.symbol;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-label="Trade confirmation">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setFill(null)} />
      <article key={fill.signature} className="senda-sheet relative w-full max-w-md overflow-hidden rounded-t-[32px] bg-[#0c0e14] shadow-[0_-20px_80px_rgba(0,0,0,0.55)] sm:rounded-[32px]">
        <div className="bg-[#d7e36a] px-4 pt-5 pb-4 text-black">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase">Filled</p>
          <h2 className="mt-1 text-3xl tracking-tight">{verb} {fill.symbol}</h2>
          <div className="senda-row mt-4 flex items-center gap-3 rounded-2xl bg-[#141414] px-3 py-3 text-white" style={{ animationDelay: "0.12s" }}>
            <span className="grid size-10 place-items-center rounded-full bg-[#d7e36a] text-xs font-bold text-black">{fill.symbol.slice(0, 2)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{fill.symbol}</span>
              <span className="block text-xs text-white/55">{verb} just now</span>
            </span>
            <span className="font-mono text-sm">{qty ? qty : `$${fill.usd.toFixed(2)}`}</span>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="senda-row font-mono text-4xl tabular-nums" style={{ animationDelay: "0.18s" }}>
            ${fill.usd > 0 ? fill.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
          </p>
          <dl className="senda-row space-y-2 text-sm" style={{ animationDelay: "0.26s" }}>
            <div className="flex justify-between gap-3"><dt className="text-subtle">You paid</dt><dd className="font-mono">{paid}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">You received</dt><dd className="font-mono">{got}</dd></div>
            {fill.executed && fill.executed > 0 ? (
              <div className="flex justify-between gap-3"><dt className="text-subtle">Executed price</dt><dd className="font-mono">${fill.executed.toLocaleString("en-US", { maximumFractionDigits: fill.executed >= 1 ? 2 : 6 })}</dd></div>
            ) : null}
            {fill.refPrice && fill.refPrice > 0 && fill.executed && fill.executed > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-subtle">Versus the screen</dt>
                <dd className="font-mono">{(((fill.executed - fill.refPrice) / fill.refPrice) * 100).toFixed(2)}%</dd>
              </div>
            ) : null}
            {fill.quotedUi && fill.quotedUi > 0 ? (
              <div className="flex justify-between gap-3"><dt className="text-subtle">Quoted</dt><dd className="font-mono">{fill.quotedUi.toLocaleString("en-US", { maximumFractionDigits: 6 })} {fill.receivedAsset || fill.symbol}</dd></div>
            ) : null}
            <div className="flex justify-between gap-3"><dt className="text-subtle">Slippage room</dt><dd className="font-mono">{((fill.slippageBps ?? 100) / 100).toFixed(1)}%</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Senda fee</dt><dd className="font-mono">{fill.platformFeeBps ?? 0} bps</dd></div>
            {fill.route ? <div className="flex justify-between gap-3"><dt className="text-subtle">Route</dt><dd className="max-w-[14rem] truncate text-right">{fill.route}</dd></div> : null}
            {fill.solFee != null ? (
              <div className="flex justify-between gap-3"><dt className="text-subtle">Network fee</dt><dd className="font-mono">{fill.solFee.toFixed(6)} SOL</dd></div>
            ) : (
              <div className="flex justify-between gap-3"><dt className="text-subtle">Network fee</dt><dd className="text-subtle">Reading the transaction…</dd></div>
            )}
            {fill.ataNew ? (
              <div className="flex justify-between gap-3"><dt className="text-subtle">Token account</dt><dd className="text-right font-mono">{(fill.solRent ?? 0).toFixed(6)} SOL · once</dd></div>
            ) : fill.solFee != null ? (
              <div className="flex justify-between gap-3"><dt className="text-subtle">Token account</dt><dd>Already open</dd></div>
            ) : null}
            {fill.solTotal != null ? (
              <div className="flex justify-between gap-3"><dt className="text-subtle">SOL spent</dt><dd className="font-mono">{fill.solTotal.toFixed(6)} SOL</dd></div>
            ) : null}
            <div className="flex justify-between gap-3"><dt className="text-subtle">Where</dt><dd>This wallet</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">When</dt><dd>{when}</dd></div>
          </dl>
          <p className="text-xs leading-relaxed text-white/45">USDC is the money the swap spends. SOL is only the network’s fuel. A new token also pays rent once, to open its account. The next buy of the same token skips that.</p>
          <a className="senda-row block truncate font-mono text-xs text-accent" style={{ animationDelay: "0.34s" }} href={`https://solscan.io/tx/${fill.signature}`} target="_blank" rel="noreferrer">
            {fill.signature}
          </a>
          <button type="button" onClick={() => setFill(null)} className="min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
            Done
          </button>
        </div>
      </article>
    </div>
  );
}

function amount(n: number, asset: string): string {
  const digits = asset === "USDC" || asset === "CASH" ? 2 : 6;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} ${asset}`;
}

function ping(fill: TradeFill) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const verb = fill.side === "sell" ? "Sold" : fill.side === "send" ? "Sent" : "Bought";
  try {
    new Notification(`${verb} ${fill.symbol}`, { body: `$${fill.usd.toFixed(2)}` });
  } catch {
    /* this browser refused the banner */
  }
}

function onTradesFromDetail(setFill: (row: TradeFill) => void) {
  const fn = (ev: Event) => {
    const row = (ev as CustomEvent<TradeFill>).detail;
    if (row?.signature) {
      setFill(row);
      ping(row);
    }
  };
  window.addEventListener("senda-trade", fn);
  return () => window.removeEventListener("senda-trade", fn);
}
