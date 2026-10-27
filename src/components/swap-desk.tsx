import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BRIDGE, quoteBridge, signBridge, type BridgeQuote } from "@/lib/bridge-swap";
import { USDC } from "@/lib/jup-exec";
import { SOL, quoteRoute, signRoute } from "@/lib/jup-sign";
import { connectPhantom, phantomProvider } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { deskFeeLine } from "@/lib/desk-fee";
import { cn } from "@/lib/utils";

function SolPair() {
  const wallet = useWallet();
  const [toSol, setToSol] = useState(true);
  const [amount, setAmount] = useState("5");
  const [got, setGot] = useState("");
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [landed, setLanded] = useState("");
  const n = Number(amount);

  useEffect(() => {
    if (!(n > 0)) {
      setGot("");
      setMs(null);
      return;
    }
    const atoms = toSol ? Math.round(n * 1e6) : Math.round(n * 1e9);
    if (atoms < 1) {
      setGot("That amount is too small.");
      return;
    }
    let on = true;
    const timer = window.setTimeout(() => {
      const started = performance.now();
      void quoteRoute({
        inputMint: toSol ? USDC : SOL,
        outputMint: toSol ? SOL : USDC,
        amountRaw: atoms,
        outDecimals: toSol ? 9 : 6,
      })
        .then((quote) => {
          if (!on) return;
          setMs(Math.max(1, Math.round(performance.now() - started)));
          setGot(toSol ? `You get ${quote.outUi.toFixed(6)} SOL` : `You get $${quote.outUi.toFixed(4)} USDC`);
        })
        .catch(() => {
          if (on) {
            setMs(null);
            setGot("No quote at this size.");
          }
        });
    }, 300);
    return () => {
      on = false;
      window.clearTimeout(timer);
    };
  }, [n, toSol]);

  async function sign() {
    if (!(n > 0)) return toast.error("Enter an amount.");
    setBusy(true);
    try {
      const live = phantomProvider()?.publicKey?.toString();
      const linked = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = live || linked || (await connectPhantom());
      if (!linked) {
        const saved = wallet.linkChain(owner, "Phantom", "phantom");
        if (!saved.ok && saved.error !== "Already linked.") throw new Error(saved.error || "The wallet did not stay.");
      }
      const atoms = toSol ? Math.round(n * 1e6) : Math.round(n * 1e9);
      const quoted = await quoteRoute({
        inputMint: toSol ? USDC : SOL,
        outputMint: toSol ? SOL : USDC,
        amountRaw: atoms,
        outDecimals: toSol ? 9 : 6,
      });
      const done = await signRoute({
        owner,
        inputMint: toSol ? USDC : SOL,
        outputMint: toSol ? SOL : USDC,
        amountRaw: atoms,
        outDecimals: toSol ? 9 : 6,
        usd: toSol ? n : quoted.outUi,
      });
      toast.success(toSol ? `${done.outUi.toFixed(6)} SOL is in this wallet.` : `$${done.outUi.toFixed(2)} USDC is in this wallet.`);
      setLanded(toSol ? `${done.outUi.toFixed(4)} SOL` : `$${done.outUi.toFixed(2)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#10141c] p-4">
      <div className="pointer-events-none absolute inset-x-8 top-[46%] h-8 overflow-hidden">
        <span className="senda-flow absolute top-3 h-[2px] w-24 rounded-full bg-[#d7e36a] shadow-[0_0_12px_#d7e36a]" />
      </div>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">On Solana</p>
      <h2 className="mt-1 text-2xl">Swap</h2>
      <div key={toSol ? "pay-usdc" : "pay-sol"} className="senda-swap mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
        <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">You pay</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setLanded(""); }} inputMode="decimal" aria-label={toSol ? "USDC" : "SOL"} className="w-full bg-transparent font-mono text-4xl outline-none" />
          <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">{toSol ? "USDC" : "SOL"}</span>
        </div>
      </div>
      <div className="relative z-10 -my-3 flex justify-center">
        <button type="button" onClick={() => { setToSol((v) => !v); setLanded(""); }} aria-label="Flip the pair" className={cn("grid h-11 w-11 place-items-center rounded-full bg-[#d7e36a] text-lg font-semibold text-black transition-transform duration-500", toSol ? "" : "rotate-180")}>
          ↕
        </button>
      </div>
      <div key={got || "wait"} className="senda-swap rounded-2xl border border-white/10 bg-black/30 p-3">
        <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">You receive</p>
        <p className="mt-1 min-h-10 font-mono text-3xl tabular-nums text-[#d7e36a]">{got || (n > 0 ? "Quoting…" : "—")}</p>
        <p className="mt-1 font-mono text-[11px] text-white/40">{ms ? `${ms}ms · Jupiter` : busy ? "Signing" : "The route reprints as you type."}</p>
      </div>
      {landed ? (
        <p className="senda-paint mt-3 text-center font-mono text-sm text-[#d7e36a]">{landed} landed in the wallet.</p>
      ) : null}
      <p className="mt-3 text-[11px] leading-snug text-white/40">{deskFeeLine(toSol ? n : 0)}</p>
      <button type="button" disabled={busy} onClick={() => void sign()} className="relative mt-3 min-h-12 w-full overflow-hidden rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
        {busy ? <span className="senda-flow absolute inset-y-0 w-16 bg-white/50" /> : null}
        <span className="relative">{busy ? "Waiting on Phantom" : "Sign the swap"}</span>
      </button>
    </section>
  );
}

export function SwapDesk() {
  const wallet = useWallet();
  const sol = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const evm = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
  const [srcId, setSrcId] = useState("solana");
  const [dstId, setDstId] = useState("base");
  const [inSym, setInSym] = useState("USDC");
  const [outSym, setOutSym] = useState("USDC");
  const [amount, setAmount] = useState("5");
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [quoteMs, setQuoteMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const src = BRIDGE.find((c) => c.id === srcId) ?? BRIDGE[0];
  const dst = BRIDGE.find((c) => c.id === dstId) ?? BRIDGE[1];
  const tokenIn = src.tokens.find((t) => t.symbol === inSym) ?? src.tokens[0];
  const tokenOut = dst.tokens.find((t) => t.symbol === outSym) ?? dst.tokens[0];

  async function sender() {
    if (src.kind === "solana") {
      const live = phantomProvider()?.publicKey?.toString();
      const who = live || sol || (await connectPhantom());
      if (who !== sol) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      return who;
    }
    if (!evm) throw new Error("Connect the Ethereum wallet on Wallets. That address signs and, if you receive there, it is where the tokens land.");
    return evm;
  }

  function recipient(): string {
    if (dst.kind === "solana") {
      if (!sol) throw new Error("Connect Phantom. The tokens land on that Solana address.");
      return sol;
    }
    if (!evm) throw new Error("Connect an Ethereum wallet. The tokens land on that address.");
    return evm;
  }

  async function quoteIt() {
    setBusy(true);
    setQuote(null);
    setQuoteMs(null);
    const started = performance.now();
    try {
      const who = await sender();
      const to = recipient();
      const next = await quoteBridge({
        src,
        dst,
        tokenIn,
        tokenOut,
        amount: Number(amount),
        sender: who,
        recipient: to,
      });
      setQuote(next);
      setQuoteMs(Math.max(1, Math.round(performance.now() - started)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No quote.");
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!quote) return;
    setBusy(true);
    try {
      const who = await sender();
      const sig = await signBridge(quote, who);
      toast.success(`Signed. ${sig.slice(0, 8)}… The other chain settles after the bridge.`);
      setQuote(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 px-3 py-3">
      <SolPair />
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Swap</p>
      <h1 className="font-display text-3xl tracking-tight">Across chains</h1>
      <p className="text-sm text-muted">
        deBridge builds the order. The wallet on the source chain signs it. Monad, Optimism, Avalanche, and BNB Chain quote the same way as Base. Senda does not hold either side.
      </p>
      <label className="block text-xs text-muted">
        From
        <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
          {BRIDGE.map((c) => (
            <button key={c.id} type="button" onClick={() => { setSrcId(c.id); if (!c.tokens.some((t) => t.symbol === inSym)) setInSym(c.tokens[0].symbol); setQuote(null); }} className={cn("min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold", src.id === c.id ? "bg-white text-black" : "border border-white/10")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {src.tokens.map((t) => (
            <button key={t.symbol} type="button" onClick={() => { setInSym(t.symbol); setQuote(null); }} className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", tokenIn.symbol === t.symbol ? "bg-accent text-accent-fg" : "border border-white/10")}>
              {t.symbol}
            </button>
          ))}
        </div>
      </label>
      <label className="block text-xs text-muted">
        To
        <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
          {BRIDGE.map((c) => (
            <button key={c.id} type="button" onClick={() => { setDstId(c.id); if (!c.tokens.some((t) => t.symbol === outSym)) setOutSym(c.tokens[0].symbol); setQuote(null); }} className={cn("min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold", dst.id === c.id ? "bg-white text-black" : "border border-white/10")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {dst.tokens.map((t) => (
            <button key={t.symbol} type="button" onClick={() => { setOutSym(t.symbol); setQuote(null); }} className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", tokenOut.symbol === t.symbol ? "bg-accent text-accent-fg" : "border border-white/10")}>
              {t.symbol}
            </button>
          ))}
        </div>
      </label>
      <label className="block text-xs text-muted">
        Amount
        <input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setQuote(null); }} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
      </label>
      <button type="button" disabled={busy} onClick={() => void quoteIt()} className="min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
        {busy && !quote ? "Quoting…" : "Quote"}
      </button>
      {quote ? (
        <div className="senda-sheet relative overflow-hidden rounded-2xl border border-white/10 bg-[#10131c] p-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 overflow-hidden">
            <span className="senda-flow absolute top-3 h-[2px] w-20 bg-accent" />
          </div>
          <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">{src.name} → {dst.name}</p>
          <p className="mt-2 text-sm">You send {quote.send} {tokenIn.symbol}.</p>
          <p className="senda-paint mt-1 font-mono text-3xl tabular-nums text-accent">≈ {quote.receive.toFixed(4)} {quote.receiveSymbol}</p>
          <p className="mt-1 text-xs text-muted">{quoteMs ? `${quoteMs}ms to build this order. ` : ""}The other chain settles after you sign. The gap is the bridge fee, not a Senda fee.</p>
          <button type="button" disabled={busy} onClick={() => void sign()} className="relative mt-3 min-h-11 w-full overflow-hidden rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy ? <span className="senda-flow absolute inset-y-0 w-16 bg-white/40" /> : null}
            <span className="relative">{busy ? "Waiting on the wallet" : "Sign"}</span>
          </button>
        </div>
      ) : null}
    </main>
  );
}
