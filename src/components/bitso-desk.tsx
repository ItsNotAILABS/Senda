import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { OutRails } from "@/components/out-rails";
import { bumpClears } from "@/components/clear-strip";
import { rememberClear } from "@/lib/clear-tape";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute, signRoute, SOL } from "@/lib/jup-sign";
import { getMxnDesk, type MxnDesk } from "@/lib/mxn-rate";
import { connectPhantom, invalidateChain, readChain, type ChainWallet } from "@/lib/phantom";
import { paySol, payUsdc } from "@/lib/solana-pay";
import { rememberTrade } from "@/lib/trade-log";
import { cn } from "@/lib/utils";

const MXNE = "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa";
const ADDR = "bitso.deposit.v1";
type Asset = "MXNe" | "USDC" | "SOL";

function addressOf(raw: string): string | null {
  try {
    return new PublicKey(raw.trim()).toBase58();
  } catch {
    return null;
  }
}

function pesos(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n);
}

/** Bitso's Solana door. USDC and SOL land. MXNe is sold for USDC first. MXNB is a different token, on Arbitrum. */
export function BitsoDesk({ owner }: { owner: string }) {
  const [asset, setAsset] = useState<Asset>("MXNe");
  const [amount, setAmount] = useState("");
  const [addr, setAddr] = useState("");
  const [desk, setDesk] = useState<MxnDesk | null>(null);
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [solPx, setSolPx] = useState(0);
  const [pesoPx, setPesoPx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState("");

  useEffect(() => {
    try {
      setAddr(localStorage.getItem(ADDR) || "");
    } catch {
      /* private mode */
    }
    let live = true;
    void getMxnDesk()
      .then((d) => live && setDesk(d))
      .catch(() => undefined);
    void fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL},${MXNE}`, { headers: { accept: "application/json" } })
      .then((r) => r.json() as Promise<Record<string, { usdPrice?: number }>>)
      .then((body) => {
        if (!live) return;
        setSolPx(Number(body[SOL]?.usdPrice) || 0);
        setPesoPx(Number(body[MXNE]?.usdPrice) || 0);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!owner) {
      setChain(null);
      return;
    }
    let live = true;
    readChain(owner)
      .then((s) => live && setChain(s))
      .catch(() => live && setChain(null));
    return () => {
      live = false;
    };
  }, [owner]);

  const rate = desk?.bitso || desk?.market || 0;
  const n = Number(amount) || 0;
  const held =
    asset === "MXNe"
      ? chain?.tokens.find((t) => t.mint === MXNE)?.ui ?? 0
      : asset === "USDC"
        ? chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0
        : chain?.sol ?? 0;
  const usd =
    asset === "USDC" ? n : asset === "SOL" ? n * solPx : n * pesoPx;
  const mxn = rate > 0 && usd > 0 ? usd * rate : 0;
  const dest = addressOf(addr);

  function keep(next: string) {
    setAddr(next);
    try {
      if (addressOf(next)) localStorage.setItem(ADDR, next.trim());
    } catch {
      /* quota */
    }
  }

  async function go() {
    if (!(n > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    if (!dest) {
      toast.error("Paste the Solana address Bitso is showing now.");
      return;
    }
    if (n > held + 1e-6) {
      toast.error("This wallet does not hold that much.");
      return;
    }
    setBusy(true);
    setLine("");
    try {
      const who = owner || (await connectPhantom());
      keep(dest);
      if (asset === "SOL") {
        const sig = await paySol({ owner: who, to: dest, sol: n });
        rememberTrade({ symbol: "SOL", side: "send", usd, mint: SOL, signature: sig });
        rememberClear({ sig, from: who, to: dest, usd, memo: "Bitso SOL", kind: "send", status: "pending" });
        bumpClears();
        setLine(`Sent ${n} SOL. ${sig.slice(0, 8)}…`);
        toast.success("SOL is on the way to Bitso.");
      } else if (asset === "USDC") {
        const paid = await payUsdc({ owner: who, to: dest, usd: n, memo: "Bitso" });
        rememberTrade({ symbol: "USDC", side: "send", usd: n, mint: USDC, signature: paid.signature });
        rememberClear({ sig: paid.signature, from: who, to: dest, usd: n, memo: "Bitso USDC", kind: "send", status: "pending" });
        bumpClears();
        setLine(`Sent $${n.toFixed(2)} USDC. ${paid.signature.slice(0, 8)}…`);
        toast.success("USDC is on the way to Bitso.");
      } else {
        const before = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
        const amountRaw = Math.round(n * 1e9);
        const quote = await quoteRoute({ inputMint: MXNE, outputMint: USDC, amountRaw, outDecimals: 6 });
        if (quote.impact > 5) throw new Error(`Price impact is ${quote.impact.toFixed(1)}%. Nothing was sent.`);
        const sold = await signRoute({ owner: who, inputMint: MXNE, outputMint: USDC, amountRaw, outDecimals: 6, usd: quote.outUi });
        rememberTrade({ symbol: "MXNe", side: "sell", usd: quote.outUi, mint: MXNE, signature: sold.signature });
        invalidateChain(who);
        const next = await readChain(who);
        setChain(next);
        const after = next.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
        const got = Math.floor((after - before) * 100) / 100;
        const send = got >= 0.01 ? got : Math.floor(quote.outUi * 100) / 100;
        if (!(send >= 0.01)) throw new Error("The pesos sold. The USDC was not there to send on.");
        const paid = await payUsdc({ owner: who, to: dest, usd: send, memo: "Bitso" });
        rememberTrade({ symbol: "USDC", side: "send", usd: send, mint: USDC, signature: paid.signature });
        rememberClear({ sig: paid.signature, from: who, to: dest, usd: send, memo: "Bitso USDC", kind: "send", status: "pending" });
        bumpClears();
        setLine(`Sold the pesos. Sent $${send.toFixed(2)} USDC. ${paid.signature.slice(0, 8)}…`);
        toast.success("Bitso got the USDC.");
      }
      if (owner) {
        invalidateChain(owner);
        readChain(owner).then(setChain).catch(() => undefined);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bitso did not get it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="bitso-rail" className="space-y-3">
      <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Bitso</p>
      <p className="text-sm text-muted">
        Bitso credits USDC and SOL on Solana. It does not credit MXNe. Pesos are sold for USDC first, then that USDC is sent. Inside Bitso you sell for MXN and withdraw by SPEI. Their peso token, MXNB, is on Arbitrum, not this wallet.
      </p>
      <ol className="space-y-1 text-sm text-muted">
        <li><span className="text-foreground">1.</span> Open Bitso and create the account. Senda cannot do the ID check.</li>
        <li><span className="text-foreground">2.</span> Verify the INE or passport, the selfie, and the CURP. Without the CURP, SPEI to a bank will not open.</li>
        <li><span className="text-foreground">3.</span> Deposit, USDC, network Solana. Copy the address it shows today.</li>
        <li><span className="text-foreground">4.</span> Paste it below. Phantom sends. Bitso credits the dollars.</li>
        <li><span className="text-foreground">5.</span> In Bitso, sell USDC for MXN, then Enviar to a CLABE, a debit card, or a phone.</li>
      </ol>
      <a href="https://bitso.com" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-sm font-semibold text-accent">Open Bitso</a>
      <div className="flex gap-1">
        {(["MXNe", "USDC", "SOL"] as const).map((id) => (
          <button key={id} type="button" onClick={() => { setAsset(id); setLine(""); }} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", asset === id ? "bg-white text-black" : "border border-white/10 text-muted")}>
            {id === "MXNe" ? "Pesos" : id}
          </button>
        ))}
      </div>
      <input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setLine(""); }} inputMode="decimal" aria-label="Amount to send to Bitso" placeholder={asset === "MXNe" ? "Pesos" : asset} className="w-full bg-transparent font-mono text-4xl tabular-nums outline-none" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAmount(held > 0 ? String(Math.floor(held * (asset === "SOL" ? 1000 : 100)) / (asset === "SOL" ? 1000 : 100)) : "")} className="min-h-9 rounded-full border border-white/10 px-3 text-xs font-semibold">
          All held
        </button>
        <p className="font-mono text-xs text-subtle">Held {held > 0 ? held.toLocaleString("en-US", { maximumFractionDigits: asset === "SOL" ? 4 : 2 }) : "0"} {asset}</p>
      </div>
      <input value={addr} onChange={(e) => keep(e.target.value.trim())} placeholder={asset === "SOL" ? "Bitso Solana address" : "Bitso Solana USDC address"} spellCheck={false} aria-label="Bitso deposit address" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
      <p className="text-xs text-muted">
        {mxn > 0 ? `About ${pesos(mxn)} on Bitso’s dollar book${desk?.bitso ? "" : ", using the market rate"}. Not their fill.` : "The peso estimate loads with the dollar book."}
        {asset === "MXNe" ? " Two signatures." : " One signature."} Paste a fresh address.
      </p>
      <button type="button" disabled={busy || !dest} onClick={() => void go()} className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Waiting on Phantom" : asset === "MXNe" ? "Withdraw pesos to Bitso" : `Send ${asset} to Bitso`}
      </button>
      {line ? <p className="font-mono text-xs text-muted">{line}</p> : null}
      <OutRails owner={owner} />
    </div>
  );
}
