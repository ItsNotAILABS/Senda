import { useEffect, useState } from "react";
import { TokenMark } from "@/components/token-mark";
import { rails } from "@/lib/ecosystem";
import { FillButton } from "@/components/fill-button";
import { impactPct, inUi, outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

const CHIPS = [10, 25, 100, 500];

export function JupBoard({ names }: { names: HouseListing[] }) {
  const [usd, setUsd] = useState(25);
  return (
    <div className="pb-8">
      <header className="px-4 pt-2">
        <p className="text-sm text-muted">Spot · Jupiter</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">Fill on the live book</h2>
        <p className="mt-2 text-sm text-muted">
          Senda is agent. Quote from Jupiter, swap USDC ↔ the PreStock mint. We don’t take the other side. Fee is the
          DEX’s.
        </p>
      </header>
      <div className="mt-3 flex gap-1 px-4">
        {CHIPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setUsd(n)}
            className={cn(
              "min-h-11 flex-1 rounded-full text-sm font-semibold",
              usd === n ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            ${n}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-border px-3">
        {names.map((s) => (
          <JupRow key={s.id} stock={s} usd={usd} />
        ))}
      </ul>
    </div>
  );
}

export function JupRow({ stock, usd, pane = false }: { stock: HouseListing; usd: number; pane?: boolean }) {
  const [q, setQ] = useState<JupQuote | { error: string } | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");

  useEffect(() => {
    let live = true;
    setQ(null);
    quoteJup({ data: { mint: stock.mint, usd, side } })
      .then((r) => {
        if (live) setQ(r);
      })
      .catch(() => {
        if (live) setQ({ error: "Quote failed." });
      });
    return () => {
      live = false;
    };
  }, [stock.mint, usd, side]);

  const ok = q && !("error" in q);
  const out = ok ? outUi(q) : 0;
  const impact = ok ? impactPct(q) : 0;

  if (pane) {
    return (
      <div>
        <div className="grid grid-cols-2 gap-2 px-6">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={cn("min-h-10 rounded-lg text-sm font-semibold", side === "buy" ? "bg-up text-up-fg" : "bg-elevated")}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={cn(
              "min-h-10 rounded-lg text-sm font-semibold",
              side === "sell" ? "bg-down text-down-fg" : "bg-elevated",
            )}
          >
            Sell
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 px-6">
          <div className="rounded-lg bg-elevated px-3 py-2">
            <dt className="text-[11px] text-subtle">You pay</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">
              {!q ? "—" : "error" in q ? "—" : side === "buy" ? `$${inUi(q).toFixed(2)}` : out.toFixed(4)}
            </dd>
          </div>
          <div className="rounded-lg bg-elevated px-3 py-2">
            <dt className="text-[11px] text-subtle">You get</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">
              {!q ? "—" : "error" in q ? "—" : side === "buy" ? out.toFixed(4) : `$${out.toFixed(2)}`}
            </dd>
          </div>
          <div className="rounded-lg bg-elevated px-3 py-2">
            <dt className="text-[11px] text-subtle">Impact</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">{ok ? `${impact.toFixed(2)}%` : "—"}</dd>
          </div>
        </dl>
        {ok ? (
          <p className="mt-3 px-6 font-mono text-[11px] text-subtle">
            {q.route[0] || "Jupiter"}
            {q.route.length > 1 ? ` +${q.route.length - 1}` : ""} · slip {q.slippageBps} bps
          </p>
        ) : null}
        <div className="px-6">
          <FillButton
            mint={stock.mint}
            usd={25}
            side={side}
            price={stock.last}
            label={side === "buy" ? "Buy in your wallet" : "Sell in your wallet"}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-fg"
          />
        </div>
      </div>
    );
  }

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <TokenMark stock={stock} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{stock.symbol}</p>
          <p className="font-mono text-[11px] text-subtle">
            last {formatUsd(stock.last)} · mark {formatUsd(stock.mark)} · {formatPremium(stock.premium)}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={cn("min-h-11 rounded-full text-xs font-semibold", side === "buy" ? "bg-up text-up-fg" : "bg-elevated")}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={cn(
            "min-h-11 rounded-full text-xs font-semibold",
            side === "sell" ? "bg-down text-down-fg" : "bg-elevated",
          )}
        >
          Sell
        </button>
      </div>
      <p className="mt-2 text-sm">
        {!q ? (
          <span className="text-muted">Quoting Jupiter…</span>
        ) : "error" in q ? (
          <span className="text-down">{q.error}</span>
        ) : side === "buy" ? (
          <>
            ${inUi(q).toFixed(2)} USDC → <span className="font-semibold tabular-nums">{out.toFixed(4)}</span> {stock.symbol}
          </>
        ) : (
          <>
            {inUi(q).toFixed(4)} {stock.symbol} → <span className="font-semibold tabular-nums">${out.toFixed(2)}</span> USDC
          </>
        )}
      </p>
      {ok ? (
        <p className="mt-1 font-mono text-[11px] text-subtle">
          {(q.route[0] || "Jupiter")}
          {q.route.length > 1 ? ` +${q.route.length - 1}` : ""} · impact {impact.toFixed(2)}% · slip {q.slippageBps} bps
        </p>
      ) : null}
      <FillButton
        mint={stock.mint}
        usd={25}
        side={side}
        price={stock.last}
        label={side === "buy" ? "Buy in your wallet" : "Sell in your wallet"}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
      />
      <a
        href={rails(stock.mint, stock.symbol).solscan}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block text-center text-[11px] font-semibold text-subtle"
      >
        Mint on Solscan
      </a>
    </li>
  );
}
