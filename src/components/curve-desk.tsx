import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { buyCurve, loadBag, loadCurves, pctGrad, sellCurve, type CurveRow } from "@/lib/curve";
import { formatMoney } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function CurveDesk() {
  const wallet = useWallet();
  const [rows, setRows] = useState(loadCurves);
  const [bag, setBag] = useState(loadBag);
  const [id, setId] = useState(rows[0]?.id ?? "");
  const [raw, setRaw] = useState("100");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const cur = rows.find((r) => r.id === id) ?? rows[0];
  const amount = Number(raw) || 0;
  const held = cur ? (bag[cur.id] ?? 0) : 0;

  function go() {
    if (!cur) return;
    if (side === "buy") {
      const debit = wallet.investOut(amount, `${cur.symbol} DBC`);
      if (!debit.ok) {
        toast.error(debit.error);
        return;
      }
      const r = buyCurve(rows, bag, cur.id, amount);
      if (r.error) {
        wallet.investIn(amount, "dbc:rollback");
        toast.error(r.error);
        return;
      }
      setRows(r.rows);
      setBag(r.bag);
      toast.success(`Bought ${r.tokens.toFixed(2)} ${cur.symbol} on the curve.`);
      return;
    }
    const r = sellCurve(rows, bag, cur.id, amount);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    wallet.investIn(r.usd, `${cur.symbol} DBC sell`);
    setRows(r.rows);
    setBag(r.bag);
    toast.success(`Sold · ${formatMoney(r.usd)} USDC.`);
  }

  return (
    <div className="flex flex-col px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        Meteora DBC · USDC in, tokens out. At 100% the curve graduates to Jupiter. Same Senda cash.
      </p>
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setId(r.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
              r.id === cur?.id ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {r.symbol}
          </button>
        ))}
      </div>
      {cur ? <CurveCard c={cur} held={held} /> : null}
      <div className="mt-4 flex gap-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "min-h-11 flex-1 rounded-full text-sm font-semibold capitalize",
              side === s ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="mt-3 min-h-14 rounded-2xl bg-elevated px-4 text-2xl font-semibold tabular-nums outline-none"
      />
      <p className="mt-1 text-xs text-subtle">
        {side === "buy" ? "USDC to spend" : "Tokens to sell"} · cash {formatMoney(wallet.w.balances.USD)}
      </p>
      <button
        type="button"
        disabled={!(amount > 0) || !cur}
        onClick={go}
        className="mt-3 min-h-12 rounded-full bg-lime text-base font-semibold text-lime-fg disabled:opacity-40"
      >
        {side === "buy" ? `Buy ${cur?.symbol ?? ""}` : `Sell ${cur?.symbol ?? ""}`}
      </button>
      <Link
        to="/accounts"
        className="mt-2 min-h-12 rounded-full bg-elevated text-center text-sm font-semibold leading-[3rem]"
      >
        Connect Phantom
      </Link>
    </div>
  );
}

function CurveCard({ c, held }: { c: CurveRow; held: number }) {
  const pct = pctGrad(c);
  return (
    <article className="mt-4 rounded-2xl bg-elevated px-4 py-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{c.name}</h2>
        <p className="text-xs font-medium text-subtle uppercase">{c.venue === "tessera" ? "T-Token" : "PreStocks"}</p>
      </div>
      <p className="mt-3 text-xs font-medium text-subtle">Bonding curve · {(pct * 100).toFixed(0)}% to graduation</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
        <div className="h-full bg-accent" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {formatMoney(c.raised)} of {formatMoney(c.target)} USDC. At the threshold liquidity moves to Jupiter.
      </p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{formatMoney(c.price)}</p>
      <p className="text-xs text-subtle">You hold {held.toFixed(2)} · last on the curve</p>
    </article>
  );
}
