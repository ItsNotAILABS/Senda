import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
import { toast } from "sonner";
import { WalletPicker } from "@/components/wallet-picker";
import { quoteRoute, signRoute, SOL, type RouteQuote } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, PRESTOCK_MINTS, readChain, type ChainWallet } from "@/lib/phantom";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { unwrapUsdc, wrapUsdc, wrappedUsdc } from "@/lib/vault-wrap";
import { getHouse, type HouseListing } from "@/lib/sol-house";
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

  const payLabel = pay === "SOL" ? "SOL" : pay === "USDC" ? "USDC" : house.find((h) => h.mint === pay)?.symbol || "Token";

  return (
    <div className="space-y-4 px-3 py-3 lg:px-4">
      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
        <div className="py-1">
          <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">Convert</p>
          <h1 className="mt-3 text-4xl tracking-tight">
            Swap <span className="text-accent">on Jupiter</span>
          </h1>
          <p className="mt-4 font-mono text-5xl tabular-nums tracking-tight">
            ${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-2 font-mono text-xs text-subtle">
            {owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Phantom not connected"}
          </p>
          {err ? <p className="mt-3 text-sm text-down">{err}</p> : null}
          <div className="mt-6 flex flex-wrap gap-2">
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
        </div>
        <aside className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
          <h2 className="text-2xl tracking-tight">
            Convert <span className="text-accent">{payLabel}</span>
          </h2>
          <p className="mt-4 text-[11px] text-subtle">You pay</p>
          <div className="mt-2 flex flex-wrap gap-2">
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
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            inputMode="decimal"
            className="mt-3 min-h-11 w-full rounded-2xl border border-white/[0.08] bg-black/30 px-3 font-mono text-lg tabular-nums outline-none"
            aria-label="Amount to pay"
          />
          <p className="mt-4 text-[11px] text-subtle">You receive</p>
          <div className="mt-2 flex flex-wrap gap-2">
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
          <dl className="mt-4 divide-y divide-white/[0.06]">
            <Row k="You pay" v={amount > 0 ? `${amount} ${payLabel}` : "—"} />
            <Row k="You receive" v={quote ? quote.outUi.toLocaleString("en-US", { maximumFractionDigits: 4 }) : qErr || "—"} />
            <Row k="Minimum received" v={quote ? quote.minUi.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"} />
            <Row k="Route" v={quote?.route || "—"} />
            <Row k="Impact" v={quote ? `${quote.impact.toFixed(2)}%` : "—"} />
          </dl>
          <button
            type="button"
            disabled={busy || !quote}
            onClick={() => void go()}
            className="mt-5 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy ? "Waiting for the wallet…" : `Convert ${payLabel}`}
          </button>
          <p className="mt-3 font-mono text-xs tabular-nums text-muted">≈ ${payUsd.toFixed(2)}</p>
        </aside>
      </section>

      <section className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
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
        <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
          <h2 className="text-sm font-semibold">Vault</h2>
          <p className="mt-1 text-sm text-muted">USDC stays in {link?.label || "the wallet"}. Wrap is the claim. Push sends it back.</p>
          <p className="mt-3 font-mono text-2xl tabular-nums">${wrapped.toFixed(2)}</p>
          <p className="text-[11px] text-subtle">Wrapped</p>
          <input
            value={wrapRaw}
            onChange={(e) => setWrapRaw(e.target.value)}
            inputMode="decimal"
            className="mt-3 min-h-11 w-full rounded-2xl border border-white/[0.08] bg-black/30 px-3 font-mono tabular-nums outline-none"
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
        <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="text-right font-mono text-xs tabular-nums">{v}</dd>
    </div>
  );
}
