import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, splHolding } from "@/lib/phantom";
import { runPrestock, spendable, type PreRoute } from "@/lib/prestock";
import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
import { WalletPicker } from "@/components/wallet-picker";
import { listChainCovers, openChainCover } from "@/lib/cover-chain";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { writeUsing, readUsing } from "@/lib/using";
import { cn } from "@/lib/utils";

const LOGO: Record<string, string> = {
  SPACEX: "/logos/spacex.png",
  OPENAI: "/logos/openai.png",
  ANTHROPIC: "/logos/anthropic.png",
  ANDURIL: "/logos/anduril.png",
  NEURALINK: "/logos/neuralink.png",
  FIGUREAI: "/logos/figureai.png",
  KALSHI: "/logos/kalshi.png",
  POLYMARKET: "/logos/polymarket.png",
  XAI: "/logos/xai.png",
};

export function PreDesk({ names, routes, query = "" }: { names: HouseListing[]; routes: PreRoute[]; query?: string }) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...names]
      .filter((n) => n.venue === "prestocks" && n.last > 0)
      .filter((n) => !q || n.symbol.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))
      .sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0));
  }, [names, query]);
  const [symbol, setSymbol] = useState(rows[0]?.symbol ?? "");
  useEffect(() => {
    const q = query.trim().toLowerCase();
    const fromSearch = q ? rows.find((r) => r.symbol.toLowerCase() === q || r.name.toLowerCase().includes(q)) : null;
    const fromUse = readUsing();
    const hit = fromSearch ?? (fromUse ? rows.find((r) => r.symbol === fromUse.symbol) : null);
    if (hit) setSymbol(hit.symbol);
  }, [query, rows]);
  const [usd, setUsd] = useState(10);
  const [quote, setQuote] = useState<JupQuote | { error: string } | null>(null);
  const [held, setHeld] = useState<{ ui: number; raw: string; decimals: number } | null>(null);
  const [decimals, setDecimals] = useState(9);
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"buy" | "cover" | "spend" | "stand">("buy");
  const [store, setStore] = useState("");
  const [reveal, setReveal] = useState<{ pan: string; cvv: string; expiry: string; last4: string } | null>(null);
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
    <div className="space-y-4 px-3 py-3 lg:px-4">
      <section className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,400px)]">
        <div className="flex flex-col justify-center py-1">
          <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">PreStock</p>
          <h1 className="mt-3 text-4xl tracking-tight">
            {name ? (
              <>
                Buy <span className="text-accent">{name.symbol}</span>
              </>
            ) : (
              <>
                No <span className="text-accent">live</span> price
              </>
            )}
          </h1>
          {name ? (
            <>
              <p className="mt-2 text-sm text-muted">{name.name}</p>
              <p className="mt-6 font-mono text-5xl tabular-nums tracking-tight">{formatUsd(name.last)}</p>
              <p className={cn("mt-2 font-mono text-sm tabular-nums", (name.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                {formatPremium(name.premium)} <span className="text-subtle">vs mark {formatUsd(name.mark)}</span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Nothing on the book is priced.</p>
          )}
        </div>
        <aside className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
          {name ? (
            <>
              <div className="flex items-center gap-3">
                {LOGO[name.symbol] ? (
                  <img src={LOGO[name.symbol]} alt="" className="size-12 rounded-2xl bg-white object-contain p-1.5" />
                ) : (
                  <span className="grid size-12 place-items-center rounded-2xl bg-black/40 font-mono text-xs">{name.symbol.slice(0, 2)}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{name.name}</p>
                  <p className="font-mono text-xs text-subtle">{name.symbol}</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
                  <span className="senda-dot size-1.5 rounded-full bg-accent" />
                  Live
                </span>
              </div>
              <p className="mt-5 font-mono text-4xl tabular-nums tracking-tight">{formatUsd(name.last)}</p>
              <p className={cn("mt-1 font-mono text-xs tabular-nums", (name.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                {formatPremium(name.premium)} · mark {formatUsd(name.mark)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat k="24h" v={name.change24h == null ? "—" : `${(name.change24h * 100).toFixed(1)}%`} />
                <Stat k="Holders" v={name.holders.toLocaleString()} />
                <Stat k="Liquidity" v={formatUsd(name.liquidity)} />
                <Stat k="You hold" v={held && held.ui > 0 ? held.ui.toFixed(4) : "none"} />
              </div>
              {name.description ? <p className="mt-4 line-clamp-3 text-sm text-muted">{name.description}</p> : null}
            </>
          ) : (
            <p className="text-sm text-muted">The live print shows up when a name is priced.</p>
          )}
        </aside>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Book</p>
            <p className="font-mono text-xs tabular-nums text-subtle">{rows.length}</p>
          </div>
          <div className="mt-3">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSymbol(r.symbol);
                  setSig(null);
                  setReveal(null);
                  writeUsing({ symbol: r.symbol, name: r.name, last: r.last, premium: r.premium, mint: r.mint });
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-t border-white/[0.06] px-2 py-3 text-left first:border-0",
                  r.symbol === name?.symbol ? "bg-accent/10" : "hover:bg-white/[0.03]",
                )}
              >
                {LOGO[r.symbol] ? (
                  <img src={LOGO[r.symbol]} alt="" className="size-8 rounded-full bg-white object-contain p-1" />
                ) : (
                  <span className="grid size-8 place-items-center rounded-full bg-black/40 text-[10px]">{r.symbol.slice(0, 2)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.symbol}</span>
                  <span className="block truncate text-[11px] text-subtle">{r.name}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-xs tabular-nums">{formatUsd(r.last)}</span>
                  <span className={cn("block font-mono text-[11px] tabular-nums", (r.change24h ?? 0) < 0 ? "text-down" : "text-accent")}>
                    {r.change24h == null ? "—" : `${(r.change24h * 100).toFixed(1)}%`}
                  </span>
                </span>
              </button>
            ))}
            {rows.length === 0 ? <p className="py-6 text-sm text-muted">No priced names.</p> : null}
          </div>
        </div>

        {name ? (
          <section className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["buy", "Buy"],
                  ["cover", "Cover"],
                  ["spend", "Spend"],
                  ["stand", "Stand"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-semibold",
                    mode === id ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "buy" ? (
              <div className="mt-5">
                <Size usd={usd} setUsd={setUsd} />
                <QuoteLine quote={quote} usd={usd} decimals={decimals} />
                {owner ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void swap("buy")}
                    className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60"
                  >
                    {busy ? "Waiting for the wallet…" : `Buy $${usd} of ${name.symbol}`}
                  </button>
                ) : (
                  <div className="mt-4">
                    <WalletPicker />
                  </div>
                )}
                <Link
                  to="/wallet"
                  search={{ buy: name.symbol }}
                  className="mt-2 flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 text-sm font-semibold text-muted"
                >
                  Pay with SOL instead
                </Link>
                {held && held.ui > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void swap("sell")}
                    className="mt-2 min-h-11 w-full rounded-full border border-white/10 text-sm font-semibold"
                  >
                    Sell ${usd} · you can raise ${spendable(held.ui, name.last).toFixed(2)}
                  </button>
                ) : owner ? (
                  <p className="mt-3 text-xs text-subtle">This wallet holds none of {name.symbol}.</p>
                ) : null}
                <p className="mt-3 font-mono text-[11px] break-all text-subtle">{routes.find((x) => x.mint === name.mint)?.route || name.mint}</p>
              </div>
            ) : null}

            {mode === "cover" ? (
              <div className="mt-5">
                <h2 className="text-2xl tracking-tight">
                  Cover a <span className="text-accent">10% drop</span>
                </h2>
                <Size usd={usd} setUsd={setUsd} />
                <dl className="mt-4 divide-y divide-white/[0.06]">
                  <Row k="Print you lock" v={formatUsd(name.last)} />
                  <Row k="Pays if last is at or under" v={formatUsd(name.last * 0.9)} />
                  <Row k="Premium now" v={`$${Math.max(1, Math.round(usd * 0.04))}`} />
                  <Row k="Pays" v={`$${usd}`} />
                </dl>
                <p className="mt-3 text-xs text-subtle">Premium is USDC from Phantom. Not a licensed policy. The token you hold stays put.</p>
                <button
                  type="button"
                  onClick={() => {
                    if (!name) return;
                    setBusy(true);
                    void (async () => {
                      try {
                        const who = owner || (await connectPhantom());
                        if (!owner) {
                          const linked = wallet.linkChain(who, "Phantom", "phantom");
                          if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
                        }
                        const premium = Math.max(1, Math.round(usd * 0.04));
                        const row = await openChainCover({
                          owner: who,
                          kind: "drop",
                          title: `${name.symbol} drop`,
                          symbol: name.symbol,
                          mint: name.mint,
                          strike: name.last,
                          cover: usd,
                          premium,
                          days: 1,
                        });
                        setSig(row.sig);
                        toast.success(`Premium signed. ${row.sig.slice(0, 8)}…`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "The premium did not send.");
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg"
                >
                  Buy the cover
                </button>
                <ul className="mt-4 space-y-2">
                  {listChainCovers()
                    .filter((d) => d.symbol === name.symbol && d.status === "open")
                    .map((d) => (
                      <li key={d.id} className="flex items-center justify-between rounded-2xl border border-white/[0.06] px-3 py-2 text-sm">
                        <span>
                          Strike <span className="font-mono tabular-nums">{formatUsd(d.strike)}</span>
                        </span>
                        <span className="font-mono text-xs tabular-nums">
                          ${d.cover} · premium ${d.premium}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            {mode === "spend" ? (
              <div className="mt-5">
                <h2 className="text-2xl tracking-tight">
                  A number, <span className="text-accent">not the token</span>
                </h2>
                <p className="mt-2 text-sm text-muted">{name.symbol} stays in the wallet. The full number is shown once.</p>
                <Size usd={usd} setUsd={setUsd} />
                <input
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  placeholder="Store, optional"
                  className="mt-3 min-h-11 w-full rounded-2xl border border-white/[0.08] bg-black/30 px-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const r = wallet.issueCheckout(usd, store, "SENDA");
                    if (!r.ok) toast.error(r.error || "Could not mint a number.");
                    else setReveal(r.reveal);
                  }}
                  className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg"
                >
                  Mint a ${usd} number
                </button>
                {reveal ? (
                  <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-gradient-to-br from-[#16161f] to-[#0c2418] p-5 font-mono">
                    <p className="tracking-[0.16em]">{reveal.pan}</p>
                    <p className="mt-2 text-sm tabular-nums">
                      {reveal.expiry} · {reveal.cvv}
                    </p>
                    <p className="mt-2 text-xs text-subtle">Shown once. A second charge is declined.</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === "stand" ? (
              <div className="mt-5">
                <h2 className="text-2xl tracking-tight">
                  Where <span className="text-accent">{name.symbol}</span> stands
                </h2>
                <ol className="mt-4">
                  {[...rows]
                    .sort((a, b) => (b.change24h ?? -9) - (a.change24h ?? -9))
                    .map((r, i) => (
                      <li
                        key={r.id}
                        className={cn(
                          "flex items-center justify-between border-t border-white/[0.06] py-2.5 text-sm first:border-0",
                          r.symbol === name.symbol ? "text-accent" : "",
                        )}
                      >
                        <span>
                          <span className="font-mono text-xs tabular-nums text-subtle">{i + 1}</span> {r.symbol}
                        </span>
                        <span className="font-mono text-xs tabular-nums">
                          {r.change24h == null ? "—" : `${(r.change24h * 100).toFixed(1)}%`} · {formatPremium(r.premium)}
                        </span>
                      </li>
                    ))}
                </ol>
              </div>
            ) : null}

            {sig ? (
              <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-4 block font-mono text-xs break-all text-accent">
                {sig}
              </a>
            ) : null}
          </section>
        ) : null}
      </div>
      <FilmBand poster="/images/markets-desk.jpg" label="A mint. Not a brokerage." />
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-2">
      <p className="text-[11px] text-subtle">{k}</p>
      <p className="font-mono text-sm tabular-nums">{v}</p>
    </div>
  );
}

function Size({ usd, setUsd }: { usd: number; setUsd: (n: number) => void }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] text-subtle">Size</p>
      <input
        value={usd}
        onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))}
        inputMode="decimal"
        aria-label="Size in dollars"
        className="mt-2 min-h-11 w-full rounded-2xl border border-white/[0.08] bg-black/30 px-3 font-mono text-lg tabular-nums outline-none"
      />
      <div className="mt-2 flex gap-2">
        {[10, 25, 100, 250].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setUsd(n)}
            className={cn(
              "min-h-9 rounded-full px-3 font-mono text-xs tabular-nums",
              usd === n ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
            )}
          >
            ${n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="text-right font-mono text-xs tabular-nums">{v}</dd>
    </div>
  );
}

function QuoteLine({ quote, usd, decimals }: { quote: JupQuote | { error: string } | null; usd: number; decimals: number }) {
  if (!quote) return <p className="mt-4 font-mono text-sm text-muted">Asking Jupiter for a route…</p>;
  if ("error" in quote) return <p className="mt-4 text-sm text-down">{quote.error}</p>;
  const impact = Math.abs(Number(quote.priceImpactPct) || 0);
  const impactPct = impact > 1 ? impact : impact * 100;
  return (
    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-subtle">${usd}</span>
        <span className="font-mono text-sm tabular-nums">{outUi(quote, decimals).toFixed(4)}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-subtle">{quote.route[0] || "Jupiter"}</span>
        <span className="font-mono tabular-nums text-muted">{impactPct.toFixed(2)}% impact</span>
      </div>
    </div>
  );
}
