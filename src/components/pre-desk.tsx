import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, splHolding } from "@/lib/phantom";
import { runPrestock, spendable, type PreRoute } from "@/lib/prestock";
import { Link } from "@tanstack/react-router";
import { WalletPicker } from "@/components/wallet-picker";
import { lockDrop, listDrops, markDropPaid } from "@/lib/drop-cover";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
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

  useEffect(() => {
    for (const d of listDrops()) {
      if (d.paid) continue;
      const row = rows.find((r) => r.symbol === d.symbol);
      if (!row || !(row.last > 0) || row.last > d.strike * 0.9) continue;
      const paid = wallet.payCover(d.cover, `${d.symbol} drop cover`);
      if (!paid.ok) continue;
      markDropPaid(d.symbol);
      toast.success(`${d.symbol} fell 10%. Cover paid $${d.cover}.`);
    }
  }, [rows, wallet]);

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
    <div className="space-y-3 px-3 py-3 lg:px-4">
      {name ? (
        <section className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              {LOGO[name.symbol] ? (
                <img src={LOGO[name.symbol]} alt="" className="size-16 rounded-2xl bg-white object-contain p-2" />
              ) : null}
              <div>
                <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">PreStock</p>
                <h1 className="text-4xl">{name.symbol}</h1>
                <p className="text-sm text-muted">{name.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-5xl tabular-nums">{formatUsd(name.last)}</p>
              <p className={cn("mt-1 font-mono text-sm", (name.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                {formatPremium(name.premium)} vs mark {formatUsd(name.mark)}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat k="24h" v={name.change24h == null ? "—" : `${(name.change24h * 100).toFixed(1)}%`} />
            <Stat k="Holders" v={name.holders.toLocaleString()} />
            <Stat k="Liquidity" v={formatUsd(name.liquidity)} />
            <Stat k="You hold" v={held && held.ui > 0 ? held.ui.toFixed(4) : "none"} />
          </div>
          <p className="mt-4 max-w-2xl text-sm text-muted">{name.description}</p>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101018]">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSymbol(r.symbol);
                setSig(null);
                setReveal(null);
              }}
              className={cn("flex w-full items-center gap-3 border-t border-white/10 px-3 py-3 text-left first:border-0", r.symbol === name?.symbol ? "bg-white/5" : "hover:bg-white/5")}
            >
              {LOGO[r.symbol] ? <img src={LOGO[r.symbol]} alt="" className="size-8 rounded-full bg-white object-contain p-1" /> : <span className="grid size-8 place-items-center rounded-full bg-black/40 text-[10px]">{r.symbol.slice(0, 2)}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{r.symbol}</span>
                <span className="block truncate text-[11px] text-subtle">{r.name}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-xs">{formatUsd(r.last)}</span>
                <span className={cn("block font-mono text-[11px]", (r.change24h ?? 0) < 0 ? "text-down" : "text-accent")}>
                  {r.change24h == null ? "—" : `${(r.change24h * 100).toFixed(1)}%`}
                </span>
              </span>
            </button>
          ))}
        </div>

        {name ? (
          <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
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
                  className={cn("min-h-10 rounded-full px-4 text-sm font-semibold", mode === id ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "buy" ? (
              <div className="mt-5 max-w-lg">
                <p className="text-sm text-muted">Jupiter quotes {name.symbol}. You sign. Senda does not take the other side.</p>
                <Size usd={usd} setUsd={setUsd} />
                <QuoteLine quote={quote} usd={usd} decimals={decimals} />
                {owner ? (
                  <button type="button" disabled={busy} onClick={() => void swap("buy")} className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60">
                    {busy ? "Waiting for the wallet…" : `Buy $${usd} of ${name.symbol}`}
                  </button>
                ) : (
                  <div className="mt-4"><WalletPicker /></div>
                )}
                <Link to="/wallet" search={{ buy: name.symbol }} className="mt-2 block text-center text-xs font-semibold text-muted">Pay with SOL instead</Link>
                {held && held.ui > 0 ? (
                  <button type="button" disabled={busy} onClick={() => void swap("sell")} className="mt-2 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
                    Sell ${usd} · you can raise ${spendable(held.ui, name.last).toFixed(2)}
                  </button>
                ) : owner ? <p className="mt-3 text-xs text-subtle">This wallet holds none of {name.symbol}.</p> : null}
                <p className="mt-3 font-mono text-[11px] text-subtle break-all">{routes.find((x) => x.mint === name.mint)?.route || name.mint}</p>
              </div>
            ) : null}

            {mode === "cover" ? (
              <div className="mt-5 max-w-lg">
                <h2 className="text-2xl">Cover a 10% drop</h2>
                <p className="mt-2 text-sm text-muted">
                  Premium is 4% of the size, taken from Senda cash now. If {name.symbol} falls from {formatUsd(name.last)} to {formatUsd(name.last * 0.9)}, the cover pays ${usd} back into cash. The token stays in the wallet. Not a licensed policy.
                </p>
                <Size usd={usd} setUsd={setUsd} />
                <dl className="mt-4 space-y-1 text-sm">
                  <Row k="Print you lock" v={formatUsd(name.last)} />
                  <Row k="Pays if last is at or under" v={formatUsd(name.last * 0.9)} />
                  <Row k="Premium now" v={`$${Math.max(1, Math.round(usd * 0.04))}`} />
                  <Row k="Pays" v={`$${usd}`} />
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    const premium = Math.max(1, Math.round(usd * 0.04));
                    const r = wallet.cover({
                      id: `drop-${name.symbol}`,
                      title: `${name.symbol} drop cover`,
                      premium,
                      cover: usd,
                      term: "pays if the token falls 10% from this print",
                    });
                    if (!r.ok) {
                      toast.error(r.error || "Not enough cash for the premium.");
                      return;
                    }
                    lockDrop({ symbol: name.symbol, strike: name.last, cover: usd, paid: false });
                    toast.success(`Covered. $${premium} now. Pays $${usd} if ${name.symbol} falls 10%.`);
                  }}
                  className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg"
                >
                  Buy the cover
                </button>
                <ul className="mt-4 space-y-2">
                  {listDrops().filter((d) => d.symbol === name.symbol).map((d) => (
                    <li key={d.strike} className="rounded-2xl bg-black/40 px-3 py-2 text-sm">
                      Locked {formatUsd(d.strike)} · pays ${d.cover} · {d.paid ? "paid" : "open"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {mode === "spend" ? (
              <div className="mt-5 max-w-lg">
                <h2 className="text-2xl">A number, not the token</h2>
                <p className="mt-2 text-sm text-muted">
                  Mint a one-time card capped at this size. The store sees the number. {name.symbol} stays in the wallet. The full number is shown once.
                </p>
                <Size usd={usd} setUsd={setUsd} />
                <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store, optional" className="mt-3 min-h-11 w-full rounded-2xl bg-black/40 px-3 text-sm outline-none" />
                <button
                  type="button"
                  onClick={() => {
                    const r = wallet.issueCheckout(usd, store, "SENDA");
                    if (!r.ok) toast.error(r.error || "Could not mint a number.");
                    else setReveal(r.reveal);
                  }}
                  className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg"
                >
                  Mint a ${usd} number
                </button>
                {reveal ? (
                  <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#16161f] to-[#0c2418] p-5 font-mono">
                    <p className="tracking-[0.16em]">{reveal.pan}</p>
                    <p className="mt-2 text-sm">{reveal.expiry} · {reveal.cvv}</p>
                    <p className="mt-2 text-xs text-subtle">Shown once. A second charge is declined.</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === "stand" ? (
              <div className="mt-5">
                <h2 className="text-2xl">Where {name.symbol} stands</h2>
                <p className="mt-2 max-w-lg text-sm text-muted">Against the other names on this book, right now. Not a link.</p>
                <ol className="mt-4 space-y-2">
                  {[...rows].sort((a, b) => (b.change24h ?? -9) - (a.change24h ?? -9)).map((r, i) => (
                    <li key={r.id} className={cn("flex items-center justify-between rounded-2xl px-3 py-2 text-sm", r.symbol === name.symbol ? "bg-accent/15" : "bg-black/30")}>
                      <span>{i + 1}. {r.symbol}</span>
                      <span className="font-mono text-xs">{r.change24h == null ? "—" : `${(r.change24h * 100).toFixed(1)}%`} · {formatPremium(r.premium)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {sig ? (
              <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-4 block font-mono text-xs text-accent break-all">{sig}</a>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-black/40 px-3 py-2">
      <p className="text-[11px] text-subtle">{k}</p>
      <p className="font-mono text-sm">{v}</p>
    </div>
  );
}

function Size({ usd, setUsd }: { usd: number; setUsd: (n: number) => void }) {
  return (
    <div className="mt-4">
      <input value={usd} onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))} inputMode="decimal" className="min-h-12 w-full rounded-2xl bg-black/40 px-3 font-mono text-lg outline-none" />
      <div className="mt-2 flex gap-1">
        {[10, 25, 100, 250].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", usd === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>${n}</button>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono text-xs">{v}</dd>
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
