import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
import { TabLead } from "@/components/tab-lead";
import { toast } from "sonner";
import { WalletPicker } from "@/components/wallet-picker";
import { quoteRoute, signRoute, SOL, type RouteQuote } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, PRESTOCK_MINTS, readChain, type ChainWallet } from "@/lib/phantom";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { unwrapUsdc, wrapUsdc, wrappedUsdc } from "@/lib/vault-wrap";
import { getHouse, formatUsd, type HouseListing } from "@/lib/sol-house";
import { runPrestock, spendable } from "@/lib/prestock";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Pay = "SOL" | "USDC" | string;

export function WalletDesk({ buy }: { buy?: string }) {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = link?.address ?? "";
  const [snap, setSnap] = useState<ChainWallet | null>(null);
  const [house, setHouse] = useState<HouseListing[]>([]);
  const [solPx, setSolPx] = useState(0);
  const [err, setErr] = useState("");
  const [cap, setCap] = useState(100);
  const [pay, setPay] = useState<Pay>("SOL");
  const [recv, setRecv] = useState(buy || "OPENAI");
  const [raw, setRaw] = useState("0.1");
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [qErr, setQErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrapRaw, setWrapRaw] = useState("25");
  const [wrapTick, setWrapTick] = useState(0);
  const [sellMint, setSellMint] = useState("");
  const [sellUsd, setSellUsd] = useState(10);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellSig, setSellSig] = useState<string | null>(null);
  const [sellOut, setSellOut] = useState<number | null>(null);
  const [sellErr, setSellErr] = useState("");

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    if (buy) setRecv(buy);
  }, [buy]);

  useEffect(() => {
    let live = true;
    getHouse()
      .then((h) => live && setHouse(h))
      .catch(() => undefined);
    quoteRoute({ inputMint: SOL, outputMint: USDC, amountRaw: 1e9, outDecimals: 6 })
      .then((q) => live && setSolPx(q.outUi))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!owner) {
      setSnap(null);
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((s) => {
          if (!live) return;
          setSnap(s);
          setErr("");
        })
        .catch((e: unknown) => live && setErr(e instanceof Error ? e.message : "Could not read the wallet."));
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  const marks = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of house) if (n.venue === "prestocks" && n.last > 0) m.set(n.mint, n.last);
    return m;
  }, [house]);

  const usdc = snap?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
  const wrapped = useMemo(() => (owner ? wrappedUsdc(owner) : 0), [owner, wrapTick]);
  const usdcFree = Math.max(0, usdc - wrapped);
  const sol = snap?.sol ?? 0;
  const solUsd = sol * solPx;
  const invested = PRESTOCK_MINTS.reduce((s, [, mint]) => {
    const ui = snap?.tokens.find((t) => t.mint === mint)?.ui ?? 0;
    return s + ui * (marks.get(mint) ?? 0);
  }, 0);
  const cash = wallet.w.balances.USD || 0;
  const total = cash + usdcFree + solUsd + invested;
  const heldPre = useMemo(() => {
    if (!snap) return [];
    const out: Array<{ symbol: string; mint: string; ui: number; decimals: number; price: number }> = [];
    for (const [symbol, mint] of PRESTOCK_MINTS) {
      const token = snap.tokens.find((t) => t.mint === mint);
      if (!token || !(token.ui > 0)) continue;
      out.push({
        symbol,
        mint,
        ui: token.ui,
        decimals: token.decimals,
        price: marks.get(mint) ?? 0,
      });
    }
    return out;
  }, [snap, marks]);

  const payMint = pay === "SOL" ? SOL : pay === "USDC" ? USDC : pay;
  const recvMint = recv === "USDC" ? USDC : PRESTOCK_MINTS.find(([s]) => s === recv)?.[1] || "";
  const amount = Number(raw) || 0;
  const payUsd = pay === "SOL" ? amount * solPx : pay === "USDC" ? amount : amount * (marks.get(payMint) ?? 0);

  useEffect(() => {
    if (!(amount > 0) || !recvMint || payMint === recvMint) {
      setQuote(null);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      const inDec = pay === "SOL" ? Promise.resolve(9) : pay === "USDC" ? Promise.resolve(6) : mintDecimals(payMint);
      const outDec = recv === "USDC" ? Promise.resolve(6) : mintDecimals(recvMint);
      Promise.all([inDec, outDec])
        .then(([dIn, dOut]) =>
          quoteRoute({
            inputMint: payMint,
            outputMint: recvMint,
            amountRaw: Math.floor(amount * 10 ** dIn),
            outDecimals: dOut,
          }),
        )
        .then((q) => {
          if (!live) return;
          setQuote(q);
          setQErr("");
        })
        .catch((e: unknown) => {
          if (!live) return;
          setQuote(null);
          setQErr(e instanceof Error ? e.message : "No route.");
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [amount, pay, payMint, recv, recvMint]);

  useEffect(() => {
    if (heldPre.length === 0) return;
    if (heldPre.some((h) => h.mint === sellMint)) return;
    setSellMint(heldPre[0].mint);
  }, [heldPre, sellMint]);

  async function onWrap() {
    if (!owner) return;
    const n = Number(wrapRaw);
    if (!(n > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    try {
      wrapUsdc(owner, link?.label || "Wallet", n, usdc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not wrap.");
      return;
    }
    const r = wallet.add(n, "USD", "usdc");
    if (!r.ok) {
      unwrapUsdc(owner, n);
      toast.error(r.error);
      return;
    }
    setWrapTick((t) => t + 1);
    toast.success(`Wrapped $${n.toFixed(2)}. It is still in the wallet.`);
  }

  async function onPush() {
    if (!owner) return;
    const n = Number(wrapRaw);
    if (!(n > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    if (n - wrapped > 0.001) {
      toast.error("Only wrapped USDC can be pushed back. Other Senda cash was not taken from this wallet.");
      return;
    }
    const r = wallet.release(n, link?.label || "Phantom");
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    unwrapUsdc(owner, n);
    setWrapTick((t) => t + 1);
    toast.success(`Pushed $${n.toFixed(2)} back to ${link?.label || "the wallet"}.`);
  }

  async function go() {
    if (!quote || !recvMint) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const dIn = pay === "SOL" ? 9 : pay === "USDC" ? 6 : await mintDecimals(payMint);
      const dOut = recv === "USDC" ? 6 : await mintDecimals(recvMint);
      const done = await signRoute({
        owner: who,
        inputMint: payMint,
        outputMint: recvMint,
        amountRaw: Math.floor(amount * 10 ** dIn),
        outDecimals: dOut,
        usd: payUsd || amount,
      });
      toast.success(`Sent ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function sellBack() {
    const row = heldPre.find((h) => h.mint === sellMint) ?? heldPre[0];
    if (!row) return;
    if (!(row.price > 0)) {
      setSellErr("No live price. Nothing was sent.");
      setSellSig(null);
      setSellOut(null);
      return;
    }
    const worth = row.ui * row.price;
    const slice = Math.min(sellUsd, worth);
    if (!(slice > 0)) {
      setSellErr("Enter a size.");
      setSellSig(null);
      setSellOut(null);
      return;
    }
    setSellBusy(true);
    setSellErr("");
    setSellSig(null);
    setSellOut(null);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({
        owner: who,
        mint: row.mint,
        usd: slice,
        side: "sell",
        price: row.price,
      });
      setSellSig(done.signature);
      setSellOut(done.outUi);
      toast.success(`Sold ${row.symbol}. ${done.signature.slice(0, 8)}…`);
      readChain(who)
        .then((s) => setSnap(s))
        .catch(() => undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The swap did not send.";
      setSellErr(msg);
      toast.error(msg);
    } finally {
      setSellBusy(false);
    }
  }

  const payLabel = pay === "SOL" ? "SOL" : pay === "USDC" ? "USDC" : house.find((h) => h.mint === pay)?.symbol || "Token";
  const recvLabel = recv === "USDC" ? "USDC" : recv;
  const sellRow = heldPre.find((h) => h.mint === sellMint) ?? heldPre[0] ?? null;
  const sellWorth = sellRow && sellRow.price > 0 ? sellRow.ui * sellRow.price : 0;
  const sellSlice = sellWorth > 0 ? Math.min(sellUsd, sellWorth) : 0;

  return (
    <div className="space-y-4 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Convert"
        title="Swap what’s in the wallet"
        accent="into the name."
        line="Jupiter names the out-amount. Phantom signs. You hold the name."
        live={["Jupiter quote", "Phantom sign", "Sell a slice back"]}
        coming={["Limit orders", "A fiat ramp that isn’t a card"]}
      />

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 lg:p-8">
        <p className="font-mono text-xs text-subtle">
          {owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Phantom not connected"}
          {total > 0 ? ` · $${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}
        </p>
        {err ? <p className="mt-2 text-sm text-down">{err}</p> : null}

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">You pay</p>
            <input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="decimal"
              aria-label="Amount to pay"
              className="mt-2 w-full bg-transparent font-mono text-5xl tabular-nums tracking-tight outline-none"
            />
            <p className="mt-1 font-mono text-sm text-muted">
              {payLabel}
              {payUsd > 0 ? ` · $${payUsd.toFixed(2)}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["SOL", "USDC"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPay(id)}
                  className={cn(
                    "min-h-9 rounded-full px-3 text-xs font-semibold",
                    pay === id ? "bg-accent text-accent-fg" : "border border-white/10",
                  )}
                >
                  {id}
                </button>
              ))}
              {PRESTOCK_MINTS.filter(([, mint]) => (snap?.tokens.find((t) => t.mint === mint)?.ui ?? 0) > 0).map(([symbol, mint]) => (
                <button
                  key={mint}
                  type="button"
                  onClick={() => setPay(mint)}
                  className={cn(
                    "min-h-9 rounded-full px-3 text-xs font-semibold",
                    pay === mint ? "bg-accent text-accent-fg" : "border border-white/10",
                  )}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">You receive</p>
            <p className="mt-2 font-mono text-5xl tabular-nums tracking-tight">
              {quote ? quote.outUi.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
            </p>
            <p className="mt-1 font-mono text-sm text-muted">{recvLabel}</p>
            {qErr && amount > 0 && payMint !== recvMint ? <p className="mt-2 text-sm text-down">{qErr}</p> : null}
            {payMint === recvMint ? <p className="mt-2 text-sm text-muted">Pick a different name.</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRecv("USDC")}
                className={cn(
                  "min-h-9 rounded-full px-3 text-xs font-semibold",
                  recv === "USDC" ? "bg-accent text-accent-fg" : "border border-white/10",
                )}
              >
                USDC
              </button>
              {PRESTOCK_MINTS.map(([symbol]) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => setRecv(symbol)}
                  className={cn(
                    "min-h-9 rounded-full px-3 text-xs font-semibold",
                    recv === symbol ? "bg-accent text-accent-fg" : "border border-white/10",
                  )}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-5">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Route fee</p>
          <p className="mt-2 font-mono text-sm tabular-nums">
            {quote ? `${quote.route} · impact ${quote.impact.toFixed(2)}%` : "—"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {quote
              ? `Min ${quote.minUi.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${recvLabel}. Senda adds none.`
              : "Nothing until Jupiter quotes. No rate is filled in ahead of that."}
          </p>
        </div>

        <button
          type="button"
          disabled={busy || sellBusy || !quote}
          onClick={() => void go()}
          className="mt-5 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting for the wallet…" : "Convert"}
        </button>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/pre" className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-sm">
            Buy
          </Link>
          <Link to="/payments" className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-sm">
            Send
          </Link>
          <Link to="/agents" className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-sm">
            Agents
          </Link>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">Sell back</p>
            <h2 className="mt-2 text-2xl tracking-tight">
              A slice back to <span className="text-accent">USDC</span>
            </h2>
          </div>
          {sellRow && sellRow.price > 0 ? (
            <p className="font-mono text-sm tabular-nums text-muted">Raise ${spendable(sellRow.ui, sellRow.price).toFixed(2)}</p>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted">Sell part of a PreStock this wallet holds. The SOL and USDC convert stays above.</p>
        {!owner ? (
          <p className="mt-4 text-sm text-muted">Connect Phantom. A PreStock in that wallet can be sold back to USDC.</p>
        ) : !snap && !err ? (
          <p className="mt-4 text-sm text-muted">Reading the wallet…</p>
        ) : heldPre.length === 0 ? (
          <p className="mt-4 text-sm text-muted">This wallet holds no PreStock.</p>
        ) : sellRow ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {heldPre.map((h) => (
                <button
                  key={h.mint}
                  type="button"
                  onClick={() => {
                    setSellMint(h.mint);
                    setSellSig(null);
                    setSellOut(null);
                    setSellErr("");
                  }}
                  className={cn(
                    "min-h-11 rounded-full px-3 text-xs font-semibold",
                    sellRow.mint === h.mint ? "bg-accent text-accent-fg" : "border border-white/10",
                  )}
                >
                  {h.symbol}
                  <span className="ml-2 font-mono tabular-nums">{h.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
                </button>
              ))}
            </div>
            {sellRow.price > 0 ? (
              <p className="mt-3 font-mono text-sm tabular-nums">
                {formatUsd(sellRow.price)} <span className="text-subtle">live · {sellRow.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })} held</span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-down">No live print for {sellRow.symbol}. Nothing will be sent.</p>
            )}
            <p className="mt-4 text-[11px] text-subtle">USD slice</p>
            <input
              value={sellUsd}
              onChange={(e) => {
                setSellUsd(Math.max(0, Number(e.target.value) || 0));
                setSellSig(null);
                setSellOut(null);
                setSellErr("");
              }}
              inputMode="decimal"
              aria-label="Dollars of the PreStock to sell back"
              className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-lg tabular-nums outline-none"
            />
            <div className="mt-2 flex gap-2">
              {[10, 25, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setSellUsd(n);
                    setSellSig(null);
                    setSellOut(null);
                    setSellErr("");
                  }}
                  className={cn(
                    "min-h-9 rounded-full px-3 font-mono text-xs tabular-nums",
                    sellUsd === n ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                  )}
                >
                  ${n}
                </button>
              ))}
              {sellWorth > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSellUsd(spendable(sellRow.ui, sellRow.price) || sellWorth);
                    setSellSig(null);
                    setSellOut(null);
                    setSellErr("");
                  }}
                  className="min-h-9 rounded-full border border-white/10 px-3 font-mono text-xs text-muted"
                >
                  Max
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={sellBusy || busy || !(sellSlice > 0)}
              onClick={() => void sellBack()}
              className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60"
            >
              {sellBusy ? "Waiting for the wallet…" : `Sell $${sellSlice.toFixed(2)} of ${sellRow.symbol}`}
            </button>
            {sellSig ? (
              <div className="mt-4">
                {sellOut != null ? (
                  <p className="font-mono text-sm tabular-nums">Jupiter out {sellOut.toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC</p>
                ) : null}
                <a href={`https://solscan.io/tx/${sellSig}`} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-xs break-all text-accent">
                  {sellSig}
                </a>
              </div>
            ) : null}
            {sellErr ? <p className="mt-3 text-sm text-down">{sellErr}</p> : null}
          </>
        ) : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Sources</h2>
          <p className="font-mono text-xs tabular-nums text-subtle">
            ${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <ul className="mt-2 divide-y divide-white/[0.06]">
          <Source name="Senda cash" value={cash} total={total} hint="In-app balance. It does not become USDC in Phantom." tint="bg-white/20" />
          <Source
            name="Phantom USDC"
            value={usdcFree}
            total={total}
            hint={wrapped > 0 ? `${owner.slice(0, 4)}… · $${wrapped.toFixed(2)} wrapped` : owner || "Not connected"}
            tint="bg-[#2775ca]"
          />
          <Source name="SOL" value={solUsd} total={total} hint={solPx ? `${sol.toFixed(4)} SOL · $${solPx.toFixed(2)}` : "Pricing SOL…"} tint="bg-[#9945ff]" />
          <Source name="PreStocks" value={invested} total={total} hint="Held in this wallet, at the live token price" tint="bg-accent" />
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-sm font-semibold">Vault</h2>
          <p className="mt-1 text-sm text-muted">USDC stays in {link?.label || "the wallet"}. Wrap is the claim. Push sends it back.</p>
          <p className="mt-3 font-mono text-2xl tabular-nums">${wrapped.toFixed(2)}</p>
          <p className="text-[11px] text-subtle">Wrapped</p>
          <input
            value={wrapRaw}
            onChange={(e) => setWrapRaw(e.target.value)}
            inputMode="decimal"
            className="mt-3 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-mono tabular-nums outline-none"
            aria-label="Amount to wrap or push"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!owner}
              onClick={() => void onWrap()}
              className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              Wrap
            </button>
            <button
              type="button"
              disabled={!owner}
              onClick={() => void onPush()}
              className="min-h-11 rounded-full border border-white/10 px-5 text-sm font-semibold disabled:opacity-50"
            >
              Push back
            </button>
          </div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-sm font-semibold">Send cap</h2>
          <p className="mt-3 font-mono text-2xl tabular-nums">${cap}</p>
          <p className="mt-1 text-sm text-muted">A bigger send is refused. The key stays in Phantom.</p>
          <div className="mt-3 flex gap-2">
            {[25, 100, 500].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCap(setSpendCap(n))}
                className={cn(
                  "min-h-9 rounded-full px-3 font-mono text-xs tabular-nums",
                  cap === n ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                )}
              >
                ${n}
              </button>
            ))}
          </div>
          {owner ? (
            <button type="button" onClick={() => wallet.unlink(owner)} className="mt-4 text-sm text-down">
              Disconnect Phantom
            </button>
          ) : (
            <div className="mt-4">
              <WalletPicker />
            </div>
          )}
        </div>
      </div>
      <FilmBand poster="/images/markets-desk.jpg" label="Already in the wallet." />
    </div>
  );
}

function Source({ name, value, hint, tint, total }: { name: string; value: number; hint: string; tint: string; total: number }) {
  const share = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <li className="py-3 first:pt-2">
      <div className="flex items-center gap-3">
        <span className={cn("size-8 shrink-0 rounded-full", tint)} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{name}</span>
          <span className="block text-xs text-subtle">{hint}</span>
        </span>
        <span className="font-mono text-sm tabular-nums">${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full", tint)} style={{ width: `${share}%` }} />
      </div>
    </li>
  );
}
