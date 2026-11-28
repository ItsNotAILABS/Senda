import { useEffect, useMemo, useState } from "react";
import { TabLead } from "@/components/tab-lead";
import { toast } from "sonner";
import { quoteRoute, signRoute, SOL, type RouteQuote } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, PRESTOCK_MINTS, readChain, sendVersioned, splHolding, chainRpc, type ChainWallet } from "@/lib/phantom";
import { pickEngine, type EngineWin } from "@/lib/convert-engine";
import { dflowExact } from "@/lib/dflow";
import { bindDflowTx } from "@/lib/dflow-bind";
import { SWAP_BOOK, SWAP_GROUPS, swapCoin, swapDecimals, type SwapCoin } from "@/lib/swap-book";
import { getHouse, formatUsd, type HouseListing } from "@/lib/sol-house";
import { runPrestock, spendable } from "@/lib/prestock";
import { payUsdc } from "@/lib/solana-pay";
import { spendCap } from "@/lib/spend-cap";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Pay = string;

export function WalletDesk({ buy, view: _view = "all" }: { buy?: string; view?: "all" | "swap" | "sell" }) {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = link?.address ?? "";
  const [snap, setSnap] = useState<ChainWallet | null>(null);
  const [house, setHouse] = useState<HouseListing[]>([]);
  const [solPx, setSolPx] = useState(0);
  const [err, setErr] = useState("");
  const [pay, setPay] = useState<Pay>(USDC);
  const [recv, setRecv] = useState(SOL);
  const [sheet, setSheet] = useState<null | "pay" | "recv">(null);
  const [find, setFind] = useState("");
  const [raw, setRaw] = useState("0.1");
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [hops, setHops] = useState<RouteQuote[]>([]);
  const [winner, setWinner] = useState<EngineWin>("jupiter");
  const [jupRaw, setJupRaw] = useState("0");
  const [qErr, setQErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [flip, setFlip] = useState(0);
  const [sellMint, setSellMint] = useState("");
  const [sellUsd, setSellUsd] = useState(10);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellSig, setSellSig] = useState<string | null>(null);
  const [sellOut, setSellOut] = useState<number | null>(null);
  const [sellErr, setSellErr] = useState("");
  const [jupTo, setJupTo] = useState("");
  const [jupUsd, setJupUsd] = useState(10);
  const [jupBusy, setJupBusy] = useState(false);

  useEffect(() => {
    if (!buy) return;
    const hit = SWAP_BOOK.find((c) => c.symbol === buy || c.mint === buy);
    if (hit) setRecv(hit.mint);
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

  const payMint = pay;
  const recvMint = recv;
  const payCoin = swapCoin(payMint);
  const recvCoin = swapCoin(recvMint);
  const amount = Number(raw) || 0;
  const payHeld = payMint === SOL ? (snap?.sol ?? 0) : (snap?.tokens.find((t) => t.mint === payMint)?.ui ?? 0);
  const payUsd = payMint === SOL ? amount * solPx : payCoin?.group === "Cash" && payCoin.symbol !== "EURC" ? amount : amount * (marks.get(payMint) ?? 0);

  function labelOf(mint: string) {
    return swapCoin(mint)?.symbol || snap?.tokens.find((t) => t.mint === mint)?.symbol || (mint === SOL ? "SOL" : `${mint.slice(0, 4)}…${mint.slice(-4)}`);
  }

  async function decimalsOf(mint: string) {
    const known = swapDecimals(mint);
    if (known != null) return known;
    const held = snap?.tokens.find((t) => t.mint === mint);
    if (held && held.decimals > 0) return held.decimals;
    if (mint === USDC) return 6;
    return mintDecimals(mint);
  }

  useEffect(() => {
    if (!(amount > 0) || !recvMint || payMint === recvMint) {
      setQuote(null);
      setHops([]);
      setWinner("jupiter");
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const dIn = await decimalsOf(payMint);
          const dOut = await decimalsOf(recvMint);
          const rawIn = Math.floor(amount * 10 ** dIn);
          const asRaw = (value: string) => (/^\d+$/.test(value) ? BigInt(value) : 0n);
          const [direct, alt] = await Promise.all([
            quoteRoute({ inputMint: payMint, outputMint: recvMint, amountRaw: rawIn, outDecimals: dOut }).then(
              (q) => ({ ok: true as const, q, reason: "" }),
              (error: unknown) => ({ ok: false as const, q: null, reason: error instanceof Error ? error.message : "Jupiter did not quote." }),
            ),
            dflowExact({ data: { inputMint: payMint, outputMint: recvMint, amount: rawIn } }).catch(() => ({ ok: false as const, reason: "DFlow did not answer." })),
          ]);
          if (!live) return;
          const dflow = alt.ok ? alt : null;
          const jup = direct.ok ? direct.q : null;
          const dflowBetter = Boolean(dflow && asRaw(dflow.outAmount) > 0n && (!jup || asRaw(dflow.outAmount) > asRaw(jup.outAmount)));
          if (dflow && dflowBetter) {
            const impact = Math.abs(Number(dflow.priceImpactPct || 0));
            const outUi = Number(dflow.outAmount) / 10 ** dOut;
            const minUi = Number(dflow.otherAmountThreshold || dflow.outAmount) / 10 ** dOut;
            const shown: RouteQuote = {
              inAmount: dflow.inAmount,
              outAmount: dflow.outAmount,
              outUi,
              minUi,
              impact,
              route: dflow.venue || "DFlow",
            };
            setQuote(shown);
            setHops([shown]);
            setWinner("dflow");
            setJupRaw(jup?.outAmount || "0");
            setQErr("");
            return;
          }
          if (jup) {
            setQuote(jup);
            setHops([jup]);
            setWinner("jupiter");
            setJupRaw(jup.outAmount);
            setQErr("");
            return;
          }
          if (payMint === USDC || recvMint === USDC) throw new Error(direct.reason || (alt.ok ? "No route." : alt.reason));
          const mid = await quoteRoute({ inputMint: payMint, outputMint: USDC, amountRaw: rawIn, outDecimals: 6 });
          const secondRaw = Math.floor(mid.outUi * 1e6);
          if (!(secondRaw > 0)) throw new Error("The first leg would not leave USDC.");
          const next = await quoteRoute({ inputMint: USDC, outputMint: recvMint, amountRaw: secondRaw, outDecimals: dOut });
          if (!live) return;
          setQuote(next);
          setHops([mid, next]);
          setWinner("via-usdc");
          setJupRaw(mid.outAmount);
          setQErr("");
        } catch (e: unknown) {
          if (!live) return;
          setQuote(null);
          setHops([]);
          setWinner("jupiter");
          setQErr(e instanceof Error ? e.message : "No route.");
        }
      })();
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [amount, payMint, recvMint]);

  useEffect(() => {
    if (heldPre.length === 0) return;
    if (heldPre.some((h) => h.mint === sellMint)) return;
    setSellMint(heldPre[0].mint);
  }, [heldPre, sellMint]);

  async function go() {
    if (!quote || !recvMint) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const dIn = await decimalsOf(payMint);
      const dOut = await decimalsOf(recvMint);
      let usd = payUsd;
      if (!(usd > 0)) {
        usd = recvMint === USDC ? quote.outUi : (await quoteRoute({ inputMint: payMint, outputMint: USDC, amountRaw: Math.floor(amount * 10 ** dIn), outDecimals: 6 })).outUi;
      }
      if (!(usd > 0)) throw new Error("No dollar mark on this size. Nothing was sent.");
      if (usd > spendCap()) throw new Error(`That is about $${usd.toFixed(0)}. Your send cap is $${spendCap()}. Raise it on Your money.`);
      if (winner === "dflow") {
        const rawIn = Math.floor(amount * 10 ** dIn);
        const row = await dflowExact({ data: { inputMint: payMint, outputMint: recvMint, amount: rawIn, owner: who } });
        if (!row.ok || !row.transaction) throw new Error(row.ok ? "DFlow did not return a transaction." : row.reason);
        const tx = await bindDflowTx(
          { quote: row, transaction: row.transaction, owner: who, inputMint: payMint, outputMint: recvMint, amount: rawIn, jupiterOut: jupRaw || "0" },
          chainRpc,
        );
        const sig = await sendVersioned(tx);
        toast.success(`DFlow signed. ${sig.slice(0, 8)}…`);
        readChain(who).then((s) => setSnap(s)).catch(() => undefined);
        return;
      }
      const plan = hops.length > 1 ? hops : [quote];
      let stepIn = Math.floor(amount * 10 ** dIn);
      for (let i = 0; i < plan.length; i += 1) {
        const inputMint = i === 0 ? payMint : USDC;
        const outputMint = i === plan.length - 1 ? recvMint : USDC;
        const outDecimals = outputMint === USDC ? 6 : dOut;
        if (i > 0) {
          const held = await splHolding(who, USDC);
          stepIn = Math.min(stepIn, Number(held.raw));
        }
        if (!(stepIn > 0)) throw new Error("The first leg did not leave USDC to convert.");
        const done = await signRoute({
          owner: who,
          inputMint,
          outputMint,
          amountRaw: stepIn,
          outDecimals,
          usd,
        });
        toast.success(plan.length > 1 ? `Leg ${i + 1} signed. ${done.signature.slice(0, 8)}…` : `Sent ${done.signature.slice(0, 8)}…`);
        stepIn = Math.floor(done.outUi * 10 ** (outputMint === USDC ? 6 : dOut));
      }
      readChain(who).then((s) => setSnap(s)).catch(() => undefined);
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

  function pickSide(mint: string) {
    if (sheet === "pay") {
      if (mint === recvMint) setRecv(payMint);
      setPay(mint);
    } else {
      if (mint === payMint) setPay(recvMint);
      setRecv(mint);
    }
    setSheet(null);
    setFind("");
  }

  const engine = pickEngine(payCoin, recvCoin, hops.length, winner);
  const payLabel = labelOf(payMint);
  const recvLabel = labelOf(recvMint);
  const sellRow = heldPre.find((h) => h.mint === sellMint) ?? heldPre[0] ?? null;
  const sellWorth = sellRow && sellRow.price > 0 ? sellRow.ui * sellRow.price : 0;
  const sellSlice = sellWorth > 0 ? Math.min(sellUsd, sellWorth) : 0;
  const chip = (on: boolean) =>
    cn("min-h-9 rounded-full px-3 text-xs font-semibold", on ? "bg-accent text-accent-fg" : "border border-white/10");

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Swap"
        title="One desk."
        accent="Swap, send, or cross a chain."
        line="Both sides are a list. In this wallet comes first. Jupiter and DFlow are raced. A pair neither can route converts through USDC. Phantom signs."
        live={["Wallet balances", "Jupiter", "DFlow", "Phantom sign"]}
        coming={["Limit orders"]}
      />

      <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        {busy ? (
          <div className="pointer-events-none absolute inset-x-6 top-[42%] z-20 h-10">
            <span className="senda-coin absolute top-0 size-7 rounded-full bg-[#d7e36a] shadow-[0_0_16px_#d7e36a]" />
          </div>
        ) : quote ? (
          <span className="senda-flow pointer-events-none absolute top-[46%] left-0 h-[2px] w-24 rounded-full bg-[#d7e36a] shadow-[0_0_12px_#d7e36a]" />
        ) : null}
        <div key={`pay-${payMint}`} className="senda-swap rounded-2xl border border-white/10 bg-black/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">You pay</p>
            <button type="button" onClick={() => { setFind(""); setSheet("pay"); }} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-semibold">
              {payLabel}
              <span className="text-white/50">▾</span>
            </button>
          </div>
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            aria-label="Amount to pay"
            className="mt-1 w-full bg-transparent font-mono text-4xl tabular-nums tracking-tight outline-none"
          />
          <p className="font-mono text-xs text-muted tabular-nums">
            {payHeld.toLocaleString("en-US", { maximumFractionDigits: 6 })} {payLabel} in this wallet
            {payUsd > 0 ? ` · $${payUsd.toFixed(2)}` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            {[
              ["25%", 0.25],
              ["Half", 0.5],
              ["Max", 1],
            ].map(([label, frac]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => {
                  const cap = payMint === SOL ? Math.max(0, payHeld - 0.02) : payHeld;
                  setRaw(String(Math.floor(cap * Number(frac) * 1e6) / 1e6 || 0));
                }}
                className="min-h-9 rounded-full bg-white/10 px-3 text-xs"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="-my-3 flex justify-center">
          <button
            type="button"
            aria-label="Flip the pair"
            onClick={() => { setPay(recvMint); setRecv(payMint); setFlip((n) => n + 1); }}
            className="relative z-10 grid h-11 w-11 place-items-center rounded-full bg-[#d7e36a] text-lg font-semibold text-black transition-transform duration-500"
            style={{ transform: `rotate(${flip * 180}deg)` }}
          >
            ↕
          </button>
        </div>

        <div key={`recv-${recvMint}-${quote?.outUi ?? "wait"}`} className="senda-swap rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">You receive</p>
            <button type="button" onClick={() => { setFind(""); setSheet("recv"); }} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-semibold">
              {recvLabel}
              <span className="text-white/50">▾</span>
            </button>
          </div>
          <p key={quote?.outAmount || "empty"} className="senda-paint mt-1 font-mono text-4xl tabular-nums tracking-tight text-[#d7e36a]">
            {quote ? quote.outUi.toLocaleString("en-US", { maximumFractionDigits: 6 }) : amount > 0 && payMint !== recvMint ? "…" : "—"}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            {quote ? `${engine.line} ${quote.route} · impact ${quote.impact.toFixed(2)}% · min ${quote.minUi.toLocaleString("en-US", { maximumFractionDigits: 6 })}` : qErr && amount > 0 && payMint !== recvMint ? qErr : "The engines quote as you type. Jupiter and DFlow. USDC in the middle when neither has a route."}
          </p>
        </div>

        {err ? <p className="mt-3 text-sm text-down">{err}</p> : null}
        {!owner ? <p className="mt-3 text-xs text-muted">Connect Phantom to read what this wallet holds. The list still quotes.</p> : null}

        <button
          type="button"
          disabled={busy || sellBusy || !quote}
          onClick={() => void go()}
          className="mt-4 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Waiting for the wallet…" : hops.length > 1 ? "Sign both legs" : winner === "dflow" ? `Sign DFlow · ${payLabel} for ${recvLabel}` : `Swap ${payLabel} for ${recvLabel}`}
        </button>
      </section>

      {sheet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setSheet(null)}>
          <div className="flex max-h-[86vh] w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-[#0c0e14] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-white/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{sheet === "pay" ? "Pay with" : "Receive"}</p>
                <button type="button" onClick={() => setSheet(null)} className="min-h-9 rounded-full px-3 text-sm text-white/60">Close</button>
              </div>
              <input
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="Search name or ticker"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm outline-none"
                autoFocus
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <SwapList
                title="In this wallet"
                rows={walletCoins(snap)}
                find={find}
                balance={(mint) => (mint === SOL ? snap?.sol ?? 0 : snap?.tokens.find((t) => t.mint === mint)?.ui ?? 0)}
                onPick={(mint) => pickSide(mint)}
              />
              {SWAP_GROUPS.map((group) => (
                <SwapList
                  key={group}
                  title={group}
                  rows={SWAP_BOOK.filter((c) => c.group === group)}
                  find={find}
                  balance={(mint) => (mint === SOL ? snap?.sol ?? 0 : snap?.tokens.find((t) => t.mint === mint)?.ui ?? 0)}
                  onPick={(mint) => pickSide(mint)}
                />
              ))}
              <p className="px-2 py-3 text-[11px] leading-snug text-white/40">
                Robinhood Chain, BNB Chain, and Arc are not on this list. Jupiter cannot swap those tokens inside this Solana wallet.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Sell back</p>
          {sellRow && sellRow.price > 0 ? (
            <p className="font-mono text-sm tabular-nums text-muted">Raise ${spendable(sellRow.ui, sellRow.price).toFixed(2)}</p>
          ) : null}
        </div>
        {!owner ? (
          <p className="mt-3 text-sm text-muted">Connect Phantom.</p>
        ) : !snap && !err ? (
          <p className="mt-3 text-sm text-muted">Reading the wallet…</p>
        ) : heldPre.length === 0 ? (
          <p className="mt-3 text-sm text-muted">This wallet holds no PreStock.</p>
        ) : sellRow ? (
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
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
                  className={cn(chip(sellRow.mint === h.mint), "min-h-11")}
                >
                  {h.symbol}
                  <span className="ml-2 font-mono tabular-nums">{h.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                className="min-h-11 w-28 rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-lg tabular-nums outline-none"
              />
              {[1, 10, 25, 100].map((n) => (
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
              className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-60 lg:shrink-0"
            >
              {sellBusy ? "Waiting for the wallet…" : `Sell $${sellSlice.toFixed(2)}`}
            </button>
          </div>
        ) : null}
        {sellRow && sellRow.price > 0 ? (
          <p className="mt-2 font-mono text-xs tabular-nums text-subtle">{formatUsd(sellRow.price)} live</p>
        ) : sellRow && !(sellRow.price > 0) ? (
          <p className="mt-2 text-sm text-down">No live print for {sellRow.symbol}. Nothing will be sent.</p>
        ) : null}
        {sellSig ? (
          <div className="mt-3">
            {sellOut != null ? (
              <p className="font-mono text-sm tabular-nums">Jupiter out {sellOut.toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC</p>
            ) : null}
            <a href={`https://solscan.io/tx/${sellSig}`} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-xs break-all text-accent">
              {sellSig}
            </a>
          </div>
        ) : null}
        {sellErr ? <p className="mt-2 text-sm text-down">{sellErr}</p> : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-gradient-to-br from-[#10131c] to-[#0c1a14] p-4">
        <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Jupiter · Rain</p>
        <p className="mt-3 text-2xl">Not issued</p>
        <p className="mt-1 text-sm text-muted">{snap ? `${(snap.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0).toFixed(2)} USDC ready` : "Connect Phantom"}</p>
        <p className="mt-6 text-right text-xs text-white/40">Needs Global ID</p>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-gradient-to-br from-[#10131c] to-[#142018] p-4">
        <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Stable · Western Union</p>
        <p className="mt-6 text-2xl">—</p>
        <div className="mt-2 flex items-end justify-between">
          <p className="text-sm text-muted">USDPT in this Phantom</p>
          <p className="text-xs text-white/40">Visa lives in their app</p>
        </div>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => window.open("https://jup.ag", "_blank", "noopener,noreferrer")} className="rounded-full bg-white px-3 py-2 text-left text-sm font-semibold text-black">
            Jupiter
            <span className="block text-[10px] font-normal">SENDS NOW</span>
          </button>
          <div className="rounded-full bg-white/10 px-3 py-2 text-sm">
            Rain
            <span className="block text-[10px] text-white/40">PROGRAM SLOT</span>
          </div>
        </div>
        <ol className="mt-4 space-y-3 text-sm">
          <li>
            <p className="text-[#d7e36a]">1</p>
            <p className="font-semibold">Open Spend</p>
            <p className="text-white/50">Jupiter app, card icon. Sign in with email, Google, or Apple.</p>
          </li>
          <li>
            <p className="text-[#d7e36a]">2</p>
            <p className="font-semibold">Global ID</p>
            <p className="text-white/50">Document, phone, liveness. Jupiter decides the country. This desk does not get a Visa issued in the United States, Mexico, or the rest of Latin America.</p>
          </li>
          <li>
            <p className="text-[#d7e36a]">3</p>
            <p className="font-semibold">Fund it here</p>
            <p className="text-white/50">Copy the Solana USDC address they show. Paste it once. Phantom sends. The 16 digits stay in Jupiter.</p>
          </li>
        </ol>
        <button type="button" onClick={() => window.open("https://jup.ag", "_blank", "noopener,noreferrer")} className="mt-4 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black">
          Open Jupiter
        </button>
        <div className="mt-3 flex gap-2">
          {[10, 25, 50].map((n) => (
            <button key={n} type="button" onClick={() => setJupUsd(n)} className={cn("min-h-10 flex-1 rounded-full text-sm", jupUsd === n ? "bg-white text-black" : "border border-white/15")}>
              ${n}
            </button>
          ))}
        </div>
        <input value={jupTo} onChange={(e) => setJupTo(e.target.value)} placeholder="Paste once. Senda keeps it." className="mt-3 min-h-11 w-full rounded-full border border-white/10 bg-transparent px-4 text-sm outline-none" />
        <button
          type="button"
          disabled={jupBusy}
          onClick={() => {
            void (async () => {
              if (!jupTo.trim()) return toast.error("Paste the address Jupiter showed.");
              setJupBusy(true);
              try {
                const who = owner || (await connectPhantom());
                if (!owner) {
                  const kept = wallet.linkChain(who, "Phantom", "phantom");
                  if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
                }
                const done = await payUsdc({ owner: who, to: jupTo.trim(), usd: jupUsd, memo: "Senda to Jupiter" });
                toast.success(`Sent. ${done.signature.slice(0, 8)}…`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Phantom did not sign.");
              } finally {
                setJupBusy(false);
              }
            })();
          }}
          className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black"
        >
          {jupBusy ? "Waiting for Phantom…" : "Send to Jupiter"}
        </button>
      </section>
    </div>
  );
}

function walletCoins(snap: ChainWallet | null): SwapCoin[] {
  const rows: SwapCoin[] = [];
  if ((snap?.sol ?? 0) > 0) rows.push({ symbol: "SOL", name: "Solana", mint: SOL, decimals: 9, group: "Cash" });
  for (const token of snap?.tokens ?? []) {
    if (!(token.ui > 0)) continue;
    const known = swapCoin(token.mint);
    rows.push(known ?? { symbol: token.symbol, name: "Held here", mint: token.mint, decimals: token.decimals || 6, group: "Cash" });
  }
  return rows;
}

function SwapList({
  title,
  rows,
  find,
  balance,
  onPick,
}: {
  title: string;
  rows: SwapCoin[];
  find: string;
  balance: (mint: string) => number;
  onPick: (mint: string) => void;
}) {
  const needle = find.trim().toLowerCase();
  const shown = rows.filter((row) => !needle || row.symbol.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle));
  if (!shown.length) return null;
  return (
    <div className="mb-3">
      <p className="px-2 py-1 text-[11px] tracking-[0.14em] text-white/40 uppercase">{title}</p>
      <ul>
        {shown.map((row) => {
          const held = balance(row.mint);
          return (
            <li key={`${title}-${row.mint}`}>
              <button type="button" onClick={() => onPick(row.mint)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2 text-left hover:bg-white/5">
                <span>
                  <span className="block text-sm font-semibold">{row.symbol}</span>
                  <span className="block text-[11px] text-white/40">{row.name}</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-white/70">{held > 0 ? held.toLocaleString("en-US", { maximumFractionDigits: 4 }) : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
