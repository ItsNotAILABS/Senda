import { useEffect, useState } from "react";
import { PrintChart } from "@/components/print-chart";
import { BuyingPower } from "@/components/buying-power";
import { TokenMark } from "@/components/token-mark";
import { FillButton } from "@/components/fill-button";
import { ShortActions } from "@/components/short-actions";
import { impactPct, inUi, outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { ExtraRails } from "@/components/extra-rails";
import { mintDecimals } from "@/lib/phantom";
import { formatChg, formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { admit, emptyBook, liquidFirst } from "@/lib/liq-router";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const CHIPS = [10, 25, 100, 250];

export function JupBoard({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [raw, setRaw] = useState("25");
  const [id, setId] = useState(names[0]?.id ?? "");
  const usd = Number(raw);
  const size = Number.isFinite(usd) && usd > 0 ? usd : 0;
  const ordered = liquidFirst(names, size || 25);
  const stock = ordered.find((n) => n.id === id) ?? ordered[0] ?? null;
  const liquid = ordered.filter((n) => n.liquidity >= 25_000).slice(0, 4);

  return (
    <div className="flex flex-col lg:grid lg:min-h-[680px] lg:grid-cols-[minmax(0,1fr)_380px]">
      <aside className="order-1 border-b border-white/10 lg:order-2 lg:border-b-0 lg:border-l">
        <header className="px-4 pt-4 pb-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Trade</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight">{stock ? stock.symbol : "Pick a name"}</h2>
          <p className="mt-1 text-sm text-muted">
            {stock ? `${stock.name} · last ${formatUsd(stock.last)}` : "The size is USDC. Phantom signs the swap."}
          </p>
        </header>
        <div className="px-4 pb-3">
          <BuyingPower owner={owner} />
        </div>
        <label className="block px-4 pb-2">
          <span className="text-xs text-white/45">Size in dollars</span>
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
            className="mt-1 min-h-14 w-full rounded-2xl bg-black/40 px-4 font-mono text-3xl tabular-nums outline-none"
          />
        </label>
        <div className="flex gap-1 px-4 pb-3">
          {CHIPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRaw(String(n))}
              className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", size === n ? "bg-white text-black" : "bg-white/8 text-white/60")}
            >
              ${n}
            </button>
          ))}
        </div>
        {stock ? (
          <>
            <div className="px-3 pb-2">
              <PrintChart mint={stock.mint} symbol={stock.symbol} className="h-[180px] lg:h-[220px]" />
            </div>
            <JupRow stock={stock} usd={size} pane />
          </>
        ) : (
          <p className="px-4 pb-6 text-sm text-muted">{emptyBook("names")}</p>
        )}
      </aside>
      <div className="order-2 min-w-0 lg:order-1">
        <div className="max-h-[420px] overflow-auto border-t border-white/10 lg:max-h-[680px] lg:border-t-0">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#10131c] font-mono text-[10px] tracking-[0.14em] text-white/35 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 text-right font-medium">Last</th>
                <th className="px-3 py-2 text-right font-medium">Pool</th>
                <th className="px-3 py-2 text-right font-medium">24h</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((s) => {
                const on = s.id === stock?.id;
                const up = (s.change24h ?? 0) >= 0;
                return (
                  <tr
                    key={s.id}
                    onClick={() => setId(s.id)}
                    className={cn("cursor-pointer border-t border-white/5", on ? "bg-white/10" : "hover:bg-white/5")}
                  >
                    <td className="px-3 py-3">
                      <span className="font-semibold">{s.symbol}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-white/40">{s.name}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatUsd(s.last)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-white/55">{s.liquidity > 0 ? `$${Math.round(s.liquidity).toLocaleString("en-US")}` : "—"}</td>
                    <td className={cn("px-3 py-3 text-right font-mono tabular-nums", up ? "text-accent" : "text-down")}>{formatChg(s.change24h)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {liquid.length ? (
            <p className="px-3 py-2 text-[11px] text-white/40">Start with a pool. {liquid.map((n) => n.symbol).join(" · ")} can take this size.</p>
          ) : null}
          {!ordered.length ? <p className="px-4 py-8 text-sm text-muted">{emptyBook("names")}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function JupRow({ stock, usd, pane = false }: { stock: HouseListing; usd: number; pane?: boolean }) {
  const [q, setQ] = useState<JupQuote | { error: string } | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [decimals, setDecimals] = useState(6);

  useEffect(() => {
    let live = true;
    void mintDecimals(stock.mint)
      .then((d) => {
        if (live && d > 0) setDecimals(d);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [stock.mint]);

  useEffect(() => {
    if (!(usd > 0)) {
      setQ({ error: "Enter a size." });
      return;
    }
    let live = true;
    setQ(null);
    const timer = window.setTimeout(() => {
      void quoteJup({ data: { mint: stock.mint, usd, side, price: stock.last, decimals } })
        .then((r) => {
          if (live) setQ(r);
        })
        .catch(() => {
          if (live) setQ({ error: "Quote failed." });
        });
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [stock.mint, stock.last, usd, side, decimals]);

  const ok = q && !("error" in q) ? q : null;
  const tokenDec = decimals;
  const pay = ok ? (side === "buy" ? inUi(ok, 6) : inUi(ok, tokenDec)) : 0;
  const get = ok ? (side === "buy" ? outUi(ok, tokenDec) : outUi(ok, 6)) : 0;
  const impact = ok ? impactPct(ok) : 0;
  const err = q && "error" in q ? q.error : "";
  const executed = side === "buy" ? (get > 0 ? usd / get : 0) : pay > 0 && get > 0 ? get / pay : 0;
  const gap = stock.last > 0 && executed > 0 ? ((executed - stock.last) / stock.last) * 100 : 0;

  const cost = (
    <div className={pane ? "mt-3 px-4" : "mt-2"}>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-subtle">You pay</dt>
          <dd className="font-mono">{!ok ? "—" : side === "buy" ? `$${pay.toFixed(2)} USDC` : `${pay.toFixed(6)} ${stock.symbol}`}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-subtle">You receive</dt>
          <dd className="font-mono">{!ok ? "—" : side === "buy" ? `${get.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${stock.symbol}` : `$${get.toFixed(2)} USDC`}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-subtle">Executed price</dt>
          <dd className="font-mono">{executed > 0 ? formatUsd(executed) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-subtle">Screen price</dt>
          <dd className="font-mono">{formatUsd(stock.last)}{executed > 0 ? ` · ${gap >= 0 ? "+" : ""}${gap.toFixed(2)}%` : ""}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-subtle">Slippage room</dt>
          <dd className="font-mono">{ok ? `${(ok.slippageBps / 100).toFixed(1)}%` : "1.0%"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-subtle">Price impact</dt>
          <dd className="font-mono">{ok ? `${impact.toFixed(2)}%` : "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-subtle">Senda fee</dt>
          <dd className="font-mono">0</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-white/45">
        USDC is the money. SOL is the network fee. The first buy of {stock.symbol} may also open its token account, about 0.002 SOL, once. The receipt after you sign splits those two.
      </p>
    </div>
  );

  if (pane) {
    const label = !ok
      ? side === "buy"
        ? `Buy $${usd || 0} ${stock.symbol}`
        : `Sell $${usd || 0} ${stock.symbol}`
      : side === "buy"
        ? `Buy ${get.toFixed(4)} ${stock.symbol}`
        : `Sell for $${get.toFixed(2)}`;
    return (
      <div className="pb-4">
        <div className="grid grid-cols-2 gap-2 px-4">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={cn("min-h-12 rounded-xl text-sm font-semibold", side === "buy" ? "bg-up text-up-fg" : "bg-elevated")}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={cn("min-h-12 rounded-xl text-sm font-semibold", side === "sell" ? "bg-down text-down-fg" : "bg-elevated")}
          >
            Sell
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 px-4">
          <div className="rounded-xl bg-elevated px-3 py-2">
            <dt className="text-[11px] text-subtle">You pay</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">
              {!q ? "…" : !ok ? "—" : side === "buy" ? `$${pay.toFixed(2)}` : `${pay.toFixed(4)}`}
            </dd>
          </div>
          <div className="rounded-xl bg-elevated px-3 py-2">
            <dt className="text-[11px] text-subtle">You get</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">
              {!q ? "…" : !ok ? "—" : side === "buy" ? get.toFixed(4) : `$${get.toFixed(2)}`}
            </dd>
          </div>
          <div className="rounded-xl bg-elevated px-3 py-2">
            <dt className="text-[11px] text-subtle">Impact</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">{!q ? "…" : ok ? `${impact.toFixed(2)}%` : "—"}</dd>
          </div>
        </dl>
        {err ? <p className="mt-3 px-4 text-sm text-down">{err}</p> : null}
        {cost}
        {ok ? (
          <p className="mt-3 px-4 font-mono text-[11px] text-subtle">
            {ok.route[0] || "Jupiter"}
            {ok.route.length > 1 ? ` +${ok.route.length - 1}` : ""}
          </p>
        ) : !q ? (
          <p className="mt-3 px-4 text-sm text-muted">Quoting Jupiter…</p>
        ) : null}
        <div className="px-4">
          {admit(usd, stock.liquidity).ok ? (
            <FillButton
              mint={stock.mint}
              usd={usd}
              side={side}
              price={stock.last}
              symbol={stock.symbol}
              label={label}
              className="mt-4 flex min-h-14 w-full items-center justify-center rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
            />
          ) : (
            <p className="mt-4 text-sm text-down">{admit(usd, stock.liquidity).reason}</p>
          )}
        </div>
        <p className="mt-2 px-4 text-center text-xs text-white/40">Phantom signs. The tokens land in that wallet.</p>
        <ExtraRails mint={stock.mint} symbol={stock.symbol} usd={usd} side={side} price={stock.last} decimals={decimals} jupOut={get} />
        <div className="px-4">
          <ShortActions symbol={stock.symbol} usd={usd} />
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
            ${pay.toFixed(2)} USDC → <span className="font-semibold tabular-nums">{get.toFixed(4)}</span> {stock.symbol}
          </>
        ) : (
          <>
            {pay.toFixed(4)} {stock.symbol} → <span className="font-semibold tabular-nums">${get.toFixed(2)}</span> USDC
          </>
        )}
      </p>
      {ok ? (
        <p className="mt-1 font-mono text-[11px] text-subtle">
          {ok.route[0] || "Jupiter"}
          {ok.route.length > 1 ? ` +${ok.route.length - 1}` : ""}
        </p>
      ) : null}
      {cost}
      <FillButton
        mint={stock.mint}
        usd={usd}
        side={side}
        price={stock.last}
        symbol={stock.symbol}
        label={side === "buy" ? `Buy $${usd} in your wallet` : `Sell $${usd} in your wallet`}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
      />
      <p className="mt-2 break-all text-center font-mono text-[11px] text-subtle">{stock.mint}</p>
      <ShortActions symbol={stock.symbol} usd={usd} />
    </li>
  );
}
