import { useEffect, useMemo, useState } from "react";
import { TabLead } from "@/components/tab-lead";
import { toast } from "sonner";
import { quoteRoute, signRoute, SOL, type RouteQuote } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, PRESTOCK_MINTS, readChain, type ChainWallet } from "@/lib/phantom";
import { getHouse, formatUsd, type HouseListing } from "@/lib/sol-house";
import { runPrestock, spendable } from "@/lib/prestock";
import { payUsdc } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const STAKES: [string, string][] = [
  ["JitoSOL", "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"],
  ["JupSOL", "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v"],
  ["mSOL", "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So"],
  ["INF", "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm"],
];

type Pay = "SOL" | "USDC" | string;

export function WalletDesk({ buy, view: _view = "all" }: { buy?: string; view?: "all" | "swap" | "sell" }) {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = link?.address ?? "";
  const [snap, setSnap] = useState<ChainWallet | null>(null);
  const [house, setHouse] = useState<HouseListing[]>([]);
  const [solPx, setSolPx] = useState(0);
  const [err, setErr] = useState("");
  const [pay, setPay] = useState<Pay>("SOL");
  const [recv, setRecv] = useState(buy || "OPENAI");
  const [raw, setRaw] = useState("0.1");
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [qErr, setQErr] = useState("");
  const [busy, setBusy] = useState(false);
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
  const recvMint =
    recv === "USDC" ? USDC : recv === "SOL" ? SOL : STAKES.find(([s]) => s === recv)?.[1] || PRESTOCK_MINTS.find(([s]) => s === recv)?.[1] || (recv.length > 30 ? recv : "");
  const amount = Number(raw) || 0;
  const payHeld = pay === "SOL" ? (snap?.sol ?? 0) : pay === "USDC" ? (snap?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0) : (snap?.tokens.find((t) => t.mint === payMint)?.ui ?? 0);
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
  const chip = (on: boolean) =>
    cn("min-h-9 rounded-full px-3 text-xs font-semibold", on ? "bg-accent text-accent-fg" : "border border-white/10");

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Swap"
        title="One desk."
        accent="Swap, send, or cross a chain."
        line="Jupiter swaps any coin in this wallet. A send moves USDC or SOL. Across chains, the source wallet signs."
        live={["Jupiter quote", "Phantom sign", "Sell a slice back"]}
        coming={["Limit orders", "A fiat ramp that isn’t a card"]}
      />

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 lg:p-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">You pay</p>
            <input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="decimal"
              aria-label="Amount to pay"
              className="mt-1 w-full bg-transparent font-mono text-5xl tabular-nums tracking-tight outline-none"
            />
            <p className="font-mono text-sm text-muted tabular-nums">
              {payLabel}
              {payUsd > 0 ? ` · $${payUsd.toFixed(2)}` : ""}
              {` · ${payHeld.toLocaleString("en-US", { maximumFractionDigits: 4 })} in the wallet`}
            </p>
            <div className="mt-3 flex gap-2">
              {[
                ["25%", 0.25],
                ["Half", 0.5],
                ["Max", pay === "SOL" ? 0.98 : 1],
              ].map(([label, frac]) => (
                <button key={String(label)} type="button" onClick={() => setRaw(String(Math.floor(payHeld * Number(frac) * 1e6) / 1e6 || 0))} className="min-h-9 rounded-full bg-white/10 px-3 text-xs">
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["SOL", "USDC"] as const).map((id) => (
                <button key={id} type="button" onClick={() => setPay(id)} className={chip(pay === id)}>
                  {id}
                </button>
              ))}
              {PRESTOCK_MINTS.filter(([, mint]) => (snap?.tokens.find((t) => t.mint === mint)?.ui ?? 0) > 0).map(([symbol, mint]) => (
                <button key={mint} type="button" onClick={() => setPay(mint)} className={chip(pay === mint)}>
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">You receive</p>
            <p className="mt-1 font-mono text-5xl tabular-nums tracking-tight">
              {quote ? quote.outUi.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
            </p>
            <p className="font-mono text-sm text-muted">{recvLabel}</p>
            {qErr && amount > 0 && payMint !== recvMint ? <p className="mt-1 text-sm text-down">{qErr}</p> : null}
            {payMint === recvMint ? <p className="mt-1 text-sm text-muted">Pick a different name.</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setRecv("USDC")} className={chip(recv === "USDC")}>
                USDC
              </button>
              {PRESTOCK_MINTS.map(([symbol]) => (
                <button key={symbol} type="button" onClick={() => setRecv(symbol)} className={chip(recv === symbol)}>
                  {symbol}
                </button>
              ))}
              {STAKES.map(([symbol]) => (
                <button key={symbol} type="button" onClick={() => setRecv(symbol)} className={chip(recv === symbol)}>
                  {symbol}
                </button>
              ))}
            </div>
            <input
              value={recv.length > 30 ? recv : ""}
              onChange={(e) => setRecv(e.target.value.trim())}
              placeholder="Any other Jupiter coin"
              className="mt-3 min-h-11 w-full rounded-full border border-white/10 bg-transparent px-4 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Route</p>
          <p className="text-right font-mono text-sm tabular-nums">
            {quote ? (
              <>
                {quote.route} · {quote.impact.toFixed(2)}%
                <span className="mt-1 block text-xs text-muted">
                  Min {quote.minUi.toLocaleString("en-US", { maximumFractionDigits: 4 })} {recvLabel}
                </span>
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        {err ? <p className="mt-2 text-sm text-down">{err}</p> : null}

        <button
          type="button"
          disabled={busy || sellBusy || !quote}
          onClick={() => void go()}
          className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting for the wallet…" : "Review"}
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(`Swap ${amount} ${payLabel} for ${recvLabel}. Route ${quote?.route ?? "Jupiter"}.`).then(() => toast.success("Copied for an agent."))}
          className="mt-3 w-full text-center text-sm text-white/55"
        >
          Copy for an agent
        </button>
      </section>

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
