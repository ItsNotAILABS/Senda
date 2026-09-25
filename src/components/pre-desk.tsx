import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, splHolding } from "@/lib/phantom";
import { runPrestock, spendable, type PreRoute } from "@/lib/prestock";
import { Link } from "@tanstack/react-router";
import { WalletPicker } from "@/components/wallet-picker";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function PreDesk({ names, routes, query = "" }: { names: HouseListing[]; routes: PreRoute[]; query?: string }) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...names]
      .filter((n) => n.venue === "prestocks" && n.last > 0)
      .filter((n) => !q || n.symbol.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))
      .sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0));
  }, [names, query]);
  const [symbol, setSymbol] = useState(rows[0]?.symbol ?? "");
  const [usd, setUsd] = useState(10);
  const [quote, setQuote] = useState<JupQuote | { error: string } | null>(null);
  const [held, setHeld] = useState<{ ui: number; raw: string; decimals: number } | null>(null);
  const [decimals, setDecimals] = useState(9);
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();
  const name = rows.find((r) => r.symbol === symbol) ?? rows[0];
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  useEffect(() => {
    if (!name) return;
    let live = true;
    setQuote(null);
    quoteJup({ data: { mint: name.mint, usd, side: "buy" } })
      .then((r) => live && setQuote(r))
      .catch(() => live && setQuote({ error: "No route" }));
    return () => {
      live = false;
    };
  }, [name?.mint, usd]);

  useEffect(() => {
    if (!name) return;
    let live = true;
    mintDecimals(name.mint)
      .then((d) => live && setDecimals(d))
      .catch(() => live && setDecimals(9));
    return () => {
      live = false;
    };
  }, [name?.mint]);

  useEffect(() => {
    if (!name || !owner) {
      setHeld(null);
      return;
    }
    let live = true;
    splHolding(owner, name.mint)
      .then((h) => live && setHeld(h))
      .catch(() => live && setHeld(null));
    return () => {
      live = false;
    };
  }, [name?.mint, owner, sig]);

  async function swap(side: "buy" | "sell") {
    if (!name) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({
        owner: who,
        mint: name.mint,
        usd,
        side,
        price: name.last,
      });
      setSig(done.signature);
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${done.outUi.toFixed(4)} on-chain.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="border-b border-border xl:border-r xl:border-b-0">
        <header className="px-5 pt-6 pb-4 lg:px-8">
          <h1 className="font-display text-4xl">Pre-IPO terminal</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {owner
              ? "The print, the mark, and a Jupiter ticket. You are not the broker. You sign the swap."
              : "Connect the wallet that already holds the money. Then buy the mint. Nothing else to deposit."}
          </p>
        </header>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr>
              <th className="px-5 py-2 font-medium lg:px-8">Company</th>
              <th className="px-2 py-2 text-right font-medium">Token</th>
              <th className="px-2 py-2 text-right font-medium">Mark</th>
              <th className="px-2 py-2 text-right font-medium">Vs mark</th>
              <th className="px-2 py-2 text-right font-medium">24h</th>
              <th className="px-5 py-2 text-right font-medium lg:px-8">Route</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => {
                  setSymbol(r.symbol);
                  setSig(null);
                }}
                className={cn("cursor-pointer border-t border-border", r.symbol === name?.symbol ? "bg-elevated" : "hover:bg-surface")}
              >
                <td className="px-5 py-3 lg:px-8">
                  <span className="font-medium">{r.symbol}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-subtle">{r.mint.slice(0, 4)}…{r.mint.slice(-4)}</span>
                </td>
                <td className="px-2 py-3 text-right font-mono tabular-nums">{formatUsd(r.last)}</td>
                <td className="px-2 py-3 text-right font-mono tabular-nums">{formatUsd(r.mark)}</td>
                <td className={cn("px-2 py-3 text-right font-mono tabular-nums", (r.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                  {formatPremium(r.premium)}
                </td>
                <td className={cn("px-2 py-3 text-right font-mono tabular-nums", (r.change24h ?? 0) < 0 ? "text-down" : "text-up")}>
                  {r.change24h == null ? "—" : `${r.change24h > 0 ? "+" : ""}${(r.change24h * 100).toFixed(1)}%`}
                </td>
                <td className="px-5 py-3 text-right font-mono text-[11px] text-muted lg:px-8">
                  {routes.find((x) => x.mint === r.mint)?.route || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <aside className="px-5 py-6 lg:px-6">
        {name ? (
          <>
            <p className="font-mono text-[11px] text-subtle">{name.mint}</p>
            <h2 className="font-display text-4xl">{name.symbol}</h2>
            <p className="mt-2 text-sm text-muted">{name.description}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-elevated px-3 py-2">
                <p className="text-subtle">24h</p>
                <p className="font-mono">{name.change24h == null ? "—" : `${(name.change24h * 100).toFixed(1)}%`}</p>
              </div>
              <div className="rounded-xl bg-elevated px-3 py-2">
                <p className="text-subtle">Holders</p>
                <p className="font-mono">{name.holders.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-elevated px-3 py-2">
                <p className="text-subtle">Liquidity</p>
                <p className="font-mono">{formatUsd(name.liquidity)}</p>
              </div>
            </div>
            <label className="mt-4 block text-xs text-subtle">
              Size
              <input
                value={usd}
                onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))}
                inputMode="decimal"
                className="mt-1 min-h-11 w-full rounded-lg bg-elevated px-3 font-mono text-sm text-fg outline-none"
              />
            </label>
            <div className="mt-2 flex gap-1">
              {[10, 25, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setUsd(n)}
                  className={cn("min-h-9 rounded-lg px-3 font-mono text-xs tabular-nums", usd === n ? "bg-fg text-bg" : "bg-elevated text-muted")}
                >
                  ${n}
                </button>
              ))}
            </div>
            <QuoteLine quote={quote} usd={usd} decimals={decimals} />
            {owner ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void swap("buy")}
                className="mt-4 min-h-12 w-full rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60"
              >
                {busy ? "Waiting for the wallet…" : `Buy with $${usd} USDC`}
              </button>
            ) : (
              <div className="mt-4">
                <WalletPicker />
              </div>
            )}
            <Link to="/wallet" search={{ buy: name.symbol }} className="mt-2 block text-center text-xs font-semibold text-muted">
              Pay with SOL instead
            </Link>
            {held && held.ui > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void swap("sell")}
                className="mt-2 min-h-11 w-full rounded-lg bg-fg px-4 text-sm font-semibold text-bg disabled:opacity-60"
              >
                Sell ${usd} · you can raise ${spendable(held.ui, name.last).toFixed(2)}
              </button>
            ) : owner ? (
              <p className="mt-3 text-xs text-subtle">This wallet holds none of {name.symbol}.</p>
            ) : null}
            {sig ? (
              <a
                href={`https://solscan.io/tx/${sig}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block font-mono text-xs text-accent break-all"
              >
                {sig}
              </a>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}

function QuoteLine({ quote, usd, decimals }: { quote: JupQuote | { error: string } | null; usd: number; decimals: number }) {
  if (!quote) return <p className="mt-4 text-sm text-muted">Asking Jupiter for a route…</p>;
  if ("error" in quote) return <p className="mt-4 text-sm text-down">{quote.error}</p>;
  const impact = Math.abs(Number(quote.priceImpactPct) || 0);
  const impactPct = impact > 1 ? impact : impact * 100;
  return (
    <p className="mt-4 font-mono text-sm">
      ${usd} → {outUi(quote, decimals).toFixed(4)} · {quote.route[0] || "Jupiter"} · {impactPct.toFixed(2)}% impact
    </p>
  );
}
