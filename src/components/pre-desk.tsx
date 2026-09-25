import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, readChain, splHolding } from "@/lib/phantom";
import { runPrestock, spendable, type PreRoute } from "@/lib/prestock";
import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
import { TabLead } from "@/components/tab-lead";
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
  const [trioUsd, setTrioUsd] = useState(10);
  const [trioPicks, setTrioPicks] = useState<string[]>([]);
  const [trioSlot, setTrioSlot] = useState(0);
  const [trioBusy, setTrioBusy] = useState(false);
  const [trioNow, setTrioNow] = useState("");
  const [trioOut, setTrioOut] = useState<Array<{ symbol: string; signature?: string; error?: string }>>([]);
  const [store, setStore] = useState("");
  const [reveal, setReveal] = useState<{ pan: string; cvv: string; expiry: string; last4: string } | null>(null);
  const wallet = useWallet();
  const name = rows.find((r) => r.symbol === symbol) ?? rows[0];
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [holds, setHolds] = useState<Array<{ symbol: string; mint: string; value: number }>>([]);
  const three = useMemo(() => {
    const chosen = trioPicks
      .map((s) => rows.find((r) => r.symbol === s))
      .filter((r): r is HouseListing => Boolean(r));
    const have = new Set(chosen.map((r) => r.symbol));
    return [...chosen, ...rows.filter((r) => !have.has(r.symbol))].slice(0, 3);
  }, [rows, trioPicks]);
  const slot = three.length === 0 ? 0 : Math.min(trioSlot, three.length - 1);

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
    if (!owner) {
      setHolds([]);
      return;
    }
    let live = true;
    readChain(owner)
      .then((snap) => {
        if (!live) return;
        const byMint = new Map<string, HouseListing>();
        for (const n of names) {
          if (n.venue !== "prestocks" || byMint.has(n.mint)) continue;
          byMint.set(n.mint, n);
        }
        const next: Array<{ symbol: string; mint: string; value: number }> = [];
        for (const token of snap.tokens) {
          const house = byMint.get(token.mint);
          if (!house || !(token.ui > 0)) continue;
          next.push({ symbol: house.symbol, mint: house.mint, value: token.ui * house.last });
        }
        next.sort((a, b) => b.value - a.value || a.symbol.localeCompare(b.symbol));
        setHolds(next);
      })
      .catch(() => live && setHolds([]));
    return () => {
      live = false;
    };
  }, [owner, names, sig, trioOut]);

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

  function putInSlot(symbol: string) {
    if (three.length < 1) return;
    const next = three.map((n) => n.symbol);
    const existing = next.indexOf(symbol);
    if (existing >= 0) {
      setTrioSlot(existing);
      return;
    }
    if (next.length < 3) return;
    next[slot] = symbol;
    setTrioPicks(next);
    setTrioOut([]);
  }

  async function buyThree() {
    const ticket = three.slice(0, 3);
    const size = trioUsd;
    if (ticket.length < 3) {
      toast.error("The book needs three live names.");
      return;
    }
    if (!(size > 0)) {
      toast.error("Enter a size.");
      return;
    }
    setTrioBusy(true);
    setTrioOut([]);
    setTrioNow(ticket[0].symbol);
    const results: Array<{ symbol: string; signature?: string; error?: string }> = [];
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      for (const n of ticket) {
        setTrioNow(n.symbol);
        try {
          const done = await runPrestock({
            owner: who,
            mint: n.mint,
            usd: size,
            side: "buy",
            price: n.last,
          });
          results.push({ symbol: n.symbol, signature: done.signature });
        } catch (e) {
          results.push({
            symbol: n.symbol,
            error: e instanceof Error ? e.message : "The swap did not send.",
          });
        }
        setTrioOut(results.slice());
      }
      const signed = results.filter((r) => r.signature).length;
      if (signed === ticket.length) toast.success(`Bought all ${signed}.`);
      else if (signed === 0) toast.error("None of the three signed.");
      else toast.success(`${signed} of ${ticket.length} signed.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The wallet did not connect.";
      setTrioOut(ticket.map((n) => ({ symbol: n.symbol, error: msg })));
      toast.error(msg);
    } finally {
      setTrioBusy(false);
      setTrioNow("");
    }
  }

  function pick(next: string) {
    const hit = rows.find((r) => r.symbol === next);
    if (!hit) return;
    setSymbol(hit.symbol);
    setSig(null);
    setReveal(null);
    writeUsing({ symbol: hit.symbol, name: hit.name, last: hit.last, premium: hit.premium, mint: hit.mint });
  }

  return (
    <div className="space-y-4 px-3 py-3 lg:px-4">
      <TabLead
        kicker="PreStocks"
        title="The pre-IPO book"
        accent="open all night."
        line="These are tokenized names you buy with the wallet you already have."
        live={["Live prices", "Buy one", "Buy three", "Cover", "Spend a number"]}
        coming={["A broker account", "Margin"]}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]">
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Ticket</p>
          {name ? (
            <>
              <label className="mt-4 block">
                <span className="text-[11px] text-subtle">Name</span>
                <select
                  value={name.symbol}
                  aria-label="Name"
                  onChange={(e) => pick(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm font-semibold outline-none"
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.symbol}>
                      {r.symbol}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 flex items-center gap-3">
                {LOGO[name.symbol] ? (
                  <img src={LOGO[name.symbol]} alt="" className="size-9 rounded-full bg-white object-contain p-1" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-full bg-black/40 font-mono text-[10px]">{name.symbol.slice(0, 2)}</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{name.symbol}</span>
                  <span className="block truncate text-[11px] text-subtle">{name.name}</span>
                </span>
                <span className="ml-auto text-right">
                  <span className="block font-mono text-sm tabular-nums">{formatUsd(name.last)}</span>
                  <span className={cn("block font-mono text-[11px] tabular-nums", (name.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                    {formatPremium(name.premium)}
                  </span>
                </span>
              </div>
              <Size usd={usd} setUsd={setUsd} />
              <QuoteLine quote={quote} usd={usd} decimals={decimals} />
              <button
                type="button"
                disabled={busy || trioBusy}
                onClick={() => void swap("buy")}
                className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60"
              >
                {busy ? "Waiting for the wallet…" : `Buy $${usd} of ${name.symbol}`}
              </button>
              {!owner ? (
                <div className="mt-4">
                  <WalletPicker />
                </div>
              ) : null}
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
                  disabled={busy || trioBusy}
                  onClick={() => void swap("sell")}
                  className="mt-2 min-h-11 w-full rounded-full border border-white/10 text-sm font-semibold"
                >
                  Sell ${usd} · you can raise ${spendable(held.ui, name.last).toFixed(2)}
                </button>
              ) : owner ? (
                <p className="mt-3 text-xs text-subtle">This wallet holds none of {name.symbol}.</p>
              ) : null}
              <p className="mt-3 font-mono text-[11px] break-all text-subtle">{routes.find((x) => x.mint === name.mint)?.route || name.mint}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No priced names.</p>
          )}
        </section>

        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Book</p>
            <p className="font-mono text-xs tabular-nums text-subtle">{rows.length}</p>
          </div>
          <div className="mt-3 flex items-center gap-3 px-2 text-[11px] tracking-[0.14em] text-subtle uppercase">
            <span className="size-8 shrink-0" />
            <span className="min-w-0 flex-1">Name</span>
            <span className="w-24 text-right">Last</span>
            <span className="w-16 text-right">Premium</span>
          </div>
          <ul className="mt-1">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => pick(r.symbol)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left",
                    r.symbol === name?.symbol ? "bg-accent/10" : "hover:bg-white/[0.03]",
                  )}
                >
                  {LOGO[r.symbol] ? (
                    <img src={LOGO[r.symbol]} alt="" className="size-8 rounded-full bg-white object-contain p-1" />
                  ) : (
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-black/40 font-mono text-[10px]">{r.symbol.slice(0, 2)}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.symbol}</span>
                    <span className="block truncate text-[11px] text-subtle">{r.name}</span>
                  </span>
                  <span className="w-24 text-right font-mono text-sm tabular-nums">{formatUsd(r.last)}</span>
                  <span className={cn("w-16 text-right font-mono text-xs tabular-nums", (r.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                    {formatPremium(r.premium)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {rows.length === 0 ? <p className="py-6 text-sm text-muted">No priced names.</p> : null}
        </section>
      </div>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">You hold</p>
          <Link to="/vault" className="text-sm font-semibold text-accent">
            Portfolio
          </Link>
        </div>
        {holds.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{owner ? "None of these names in this wallet." : "Connect a wallet to see what you hold."}</p>
        ) : (
          <ul className="mt-3 flex gap-2 overflow-x-auto">
            {holds.map((h) => (
              <li key={h.mint} className="shrink-0 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                <p className="font-mono text-xs text-subtle">{h.symbol}</p>
                <p className="font-mono text-sm tabular-nums">{h.value > 0 ? formatUsd(h.value) : "$0.00"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {name ? (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
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
                  disabled={busy || trioBusy}
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

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">Buy three</p>
            <h2 className="mt-2 text-2xl tracking-tight">
              One size, <span className="text-accent">three names</span>
            </h2>
          </div>
          <p className="font-mono text-sm tabular-nums text-muted">
            {three.length} × ${trioUsd}
            {three.length === 3 ? <span className="text-subtle"> · ${three.length * trioUsd}</span> : null}
          </p>
        </div>
        <p className="mt-2 text-sm text-muted">Each name is its own Jupiter swap. Phantom signs them in turn. The single-name buy stays above.</p>
        {three.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No priced names on the book.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {three.map((n, i) => (
                <button
                  key={n.symbol}
                  type="button"
                  onClick={() => setTrioSlot(i)}
                  className={cn(
                    "rounded-2xl border border-white/10 bg-black/25 p-3 text-left",
                    i === slot ? "ring-1 ring-accent" : "",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {LOGO[n.symbol] ? (
                      <img src={LOGO[n.symbol]} alt="" className="size-8 rounded-full bg-white object-contain p-1" />
                    ) : (
                      <span className="grid size-8 place-items-center rounded-full bg-black/40 font-mono text-[10px]">{n.symbol.slice(0, 2)}</span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{n.symbol}</span>
                      <span className="block truncate text-[11px] text-subtle">{n.name}</span>
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-lg tabular-nums">{formatUsd(n.last)}</p>
                  <p className={cn("font-mono text-[11px] tabular-nums", (n.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                    {formatPremium(n.premium)}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {rows.map((r) => {
                const on = three.some((t) => t.symbol === r.symbol);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => putInSlot(r.symbol)}
                    className={cn(
                      "min-h-9 rounded-full px-3 font-mono text-xs",
                      on ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                    )}
                  >
                    {r.symbol}
                  </button>
                );
              })}
            </div>
            <Size usd={trioUsd} setUsd={setTrioUsd} label="Dollars for each name" />
            <button
              type="button"
              disabled={trioBusy || busy || three.length < 3}
              onClick={() => void buyThree()}
              className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60"
            >
              {trioBusy ? `Signing ${trioNow}…` : three.length < 3 ? "Need three live names" : `Buy $${trioUsd} of each`}
            </button>
            {trioOut.length > 0 ? (
              <ul className="mt-4 divide-y divide-white/10">
                {trioOut.map((row) => (
                  <li key={row.symbol} className="flex items-start justify-between gap-3 py-2">
                    <span className="text-sm font-semibold">{row.symbol}</span>
                    {row.signature ? (
                      <a
                        href={`https://solscan.io/tx/${row.signature}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 text-right font-mono text-xs break-all text-accent"
                      >
                        {row.signature}
                      </a>
                    ) : (
                      <span className="text-right text-xs text-down">{row.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>
      <FilmBand poster="/images/markets-desk.jpg" label="A mint. Not a brokerage." />
    </div>
  );
}

function Size({ usd, setUsd, label = "Size in dollars" }: { usd: number; setUsd: (n: number) => void; label?: string }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] text-subtle">USD</p>
      <input
        value={usd}
        onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))}
        inputMode="decimal"
        aria-label={label}
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
