import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { WalletPicker } from "@/components/wallet-picker";
import { quoteRoute, signRoute, SOL, type RouteQuote } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, PRESTOCK_MINTS, readChain, type ChainWallet } from "@/lib/phantom";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
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
  const sol = snap?.sol ?? 0;
  const solUsd = sol * solPx;
  const invested = PRESTOCK_MINTS.reduce((s, [, mint]) => {
    const ui = snap?.tokens.find((t) => t.mint === mint)?.ui ?? 0;
    return s + ui * (marks.get(mint) ?? 0);
  }, 0);
  const cash = wallet.w.balances.USD || 0;
  const total = cash + usdc + solUsd + invested;

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
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="border-b border-border px-5 py-6 lg:px-8 xl:border-r xl:border-b-0">
        <p className="text-sm text-muted">Your money</p>
        <h1 className="mt-1 font-display text-6xl tabular-nums tracking-tight">
          ${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Phantom is already money. You do not deposit it into another account before you can buy, swap, or sell.
        </p>
        <ul className="mt-6 max-w-md divide-y divide-border">
          <Source name="Senda cash" value={cash} hint="In-app balance. It does not become USDC in Phantom." />
          <Source name="Phantom USDC" value={usdc} hint={owner ? owner : "Not connected"} />
          <Source name="SOL" value={solUsd} hint={solPx ? `${sol.toFixed(4)} SOL · $${solPx.toFixed(2)}` : "Pricing SOL…"} />
          <Source name="PreStocks" value={invested} hint="Held in this wallet, at the live token price" />
        </ul>
        {err ? <p className="mt-3 text-sm text-down">{err}</p> : null}
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link to="/pre" className="rounded-lg bg-elevated px-3 py-2">Buy</Link>
          <Link to="/payments" className="rounded-lg bg-elevated px-3 py-2">Send</Link>
          <Link to="/agents" className="rounded-lg bg-elevated px-3 py-2">Agents</Link>
          <a href={owner ? `https://solscan.io/account/${owner}` : undefined} className="rounded-lg bg-elevated px-3 py-2 text-muted">
            Account
          </a>
        </div>
        <div className="mt-8 max-w-xl">
          <h2 className="text-sm font-semibold">Send cap</h2>
          <p className="mt-1 text-sm text-muted">A bigger send is refused. The key never leaves Phantom. Every send is simulated first.</p>
          <div className="mt-3 flex gap-1">
            {[25, 100, 500].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCap(setSpendCap(n))}
                className={cn("min-h-9 rounded-lg px-3 font-mono text-xs", cap === n ? "bg-fg text-bg" : "bg-elevated text-muted")}
              >
                ${n}
              </button>
            ))}
          </div>
          {owner ? (
            <button type="button" onClick={() => wallet.unlink(owner)} className="mt-3 text-sm text-down">
              Disconnect Phantom
            </button>
          ) : (
            <div className="mt-4">
              <WalletPicker />
            </div>
          )}
        </div>
      </section>
      <aside className="px-5 py-6 lg:px-6">
        <h2 className="font-display text-3xl">Convert</h2>
        <p className="mt-1 text-sm text-muted">SOL, USDC, or a PreStock you hold. One signature.</p>
        <p className="mt-4 text-xs text-subtle">You pay</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {(["SOL", "USDC"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setPay(id)} className={cn("min-h-9 rounded-lg px-3 text-xs font-semibold", pay === id ? "bg-fg text-bg" : "bg-elevated")}>
              {id}
            </button>
          ))}
          {PRESTOCK_MINTS.filter(([, mint]) => (snap?.tokens.find((t) => t.mint === mint)?.ui ?? 0) > 0).map(([symbol, mint]) => (
            <button key={mint} type="button" onClick={() => setPay(mint)} className={cn("min-h-9 rounded-lg px-3 text-xs font-semibold", pay === mint ? "bg-fg text-bg" : "bg-elevated")}>
              {symbol}
            </button>
          ))}
        </div>
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          inputMode="decimal"
          className="mt-3 min-h-12 w-full rounded-lg bg-elevated px-3 font-mono text-lg outline-none"
          aria-label="Amount to pay"
        />
        <p className="mt-4 text-xs text-subtle">You receive</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <button type="button" onClick={() => setRecv("USDC")} className={cn("min-h-9 rounded-lg px-3 text-xs font-semibold", recv === "USDC" ? "bg-fg text-bg" : "bg-elevated")}>
            USDC
          </button>
          {PRESTOCK_MINTS.map(([symbol]) => (
            <button key={symbol} type="button" onClick={() => setRecv(symbol)} className={cn("min-h-9 rounded-lg px-3 text-xs font-semibold", recv === symbol ? "bg-fg text-bg" : "bg-elevated")}>
              {symbol}
            </button>
          ))}
        </div>
        <dl className="mt-4 space-y-1 text-sm">
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
          className="mt-5 min-h-12 w-full rounded-lg bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting for the wallet…" : `Convert ${payLabel}`}
        </button>
        <p className="mt-3 text-xs text-muted">
          About ${payUsd.toFixed(2)}. Borrowing against these names is not on a lend market, so raising cash is this sale.
        </p>
      </aside>
    </div>
  );
}

function Source({ name, value, hint }: { name: string; value: number; hint: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{name}</span>
        <span className="block text-xs text-subtle">{hint}</span>
      </span>
      <span className="font-mono text-sm tabular-nums">${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
    </li>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-mono text-xs">{v}</dd>
    </div>
  );
}
