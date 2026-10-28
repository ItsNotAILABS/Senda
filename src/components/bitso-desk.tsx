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
  const [review, setReview] = useState(false);
  const [age, setAge] = useState(0);

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
    const id = window.setInterval(() => setAge((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (age === 0 || age % 30 !== 0) return;
    void getMxnDesk().then(setDesk).catch(() => undefined);
  }, [age]);

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
    setReview(false);
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

  const left = 30 - (age % 30);
  const step1 = asset === "MXNe" ? "Sell pesos" : asset === "SOL" ? "Send SOL" : "Send USDC";

  return (
    <div id="bitso-rail" className="space-y-3 rounded-[22px] border border-white/10 bg-black p-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Liquify</p>
      <h2 className="text-2xl font-semibold tracking-tight">Cash-out planner</h2>
      <p className="text-sm text-white/55">Move from Solana to Bitso. You sign the first step. The sale and the bank transfer happen in Bitso.</p>
      <ol className="grid gap-2 sm:grid-cols-3">
        {[
          [step1, asset === "SOL" ? "Solana" : "Solana"],
          ["Convert on Bitso", "USDC → MXN"],
          ["Receive MXN", "SPEI, in their app"],
        ].map(([title, sub], i) => (
          <li key={title} className="rounded-2xl border border-white/10 px-3 py-3">
            <p className="font-mono text-[10px] text-accent">{i + 1}</p>
            <p className="mt-1 text-sm font-semibold">{title}</p>
            <p className="text-xs text-white/45">{sub}</p>
          </li>
        ))}
      </ol>
      <div className="flex gap-1">
        {(["USDC", "MXNe", "SOL"] as const).map((id) => (
          <button key={id} type="button" onClick={() => { setAsset(id); setLine(""); setReview(false); }} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", asset === id ? "bg-white text-black" : "border border-white/10 text-white/60")}>
            {id === "MXNe" ? "Pesos" : id}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <div className="rounded-2xl border border-white/10 px-3 py-3">
          <p className="text-xs text-white/45">You send</p>
          <input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setLine(""); setReview(false); }} inputMode="decimal" aria-label="Amount to send to Bitso" placeholder="0" className="mt-1 w-full bg-transparent font-mono text-4xl tabular-nums outline-none" />
          <p className="text-xs text-white/45">{asset === "MXNe" ? "Pesos on Solana" : asset} · held {held > 0 ? held.toLocaleString("en-US", { maximumFractionDigits: asset === "SOL" ? 4 : 2 }) : "0"}</p>
        </div>
        <p className="hidden self-center text-white/30 sm:block">→</p>
        <div className="rounded-2xl border border-white/10 px-3 py-3">
          <p className="text-xs text-white/45">You receive, estimated</p>
          <p className="mt-1 font-mono text-3xl tabular-nums">{mxn > 0 ? pesos(mxn) : "Quote pending"}</p>
          <p className="text-xs text-white/45">{rate > 0 ? `MXN · ${desk?.bitso ? "Bitso dollar book" : "market"} · ${left}s` : "Waiting on the book"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAmount(held > 0 ? String(Math.floor(held * (asset === "SOL" ? 1000 : 100)) / (asset === "SOL" ? 1000 : 100)) : "")} className="h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">All held</button>
      </div>
      <input id="bitso-addr" value={addr} onChange={(e) => keep(e.target.value.trim())} placeholder={asset === "SOL" ? "Bitso Solana address" : "Bitso Solana USDC address"} spellCheck={false} aria-label="Bitso deposit address" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black px-3 font-mono text-xs outline-none" />
      <div className="grid gap-2 sm:grid-cols-3">
        <p className="rounded-2xl bg-white/[0.04] px-3 py-2 text-xs text-white/55"><span className="block font-semibold text-white">Solana transfer</span>Seconds to minutes after the signature.</p>
        <p className="rounded-2xl bg-white/[0.04] px-3 py-2 text-xs text-white/55"><span className="block font-semibold text-white">Bitso conversion</span>Their quote. This estimate refreshes every 30 seconds. It is not their fill.</p>
        <p className="rounded-2xl bg-white/[0.04] px-3 py-2 text-xs text-white/55"><span className="block font-semibold text-white">SPEI</span>A business day, inside Bitso, after you sell. This desk does not send the peso.</p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-3">
        <p className="text-sm"><span className="font-semibold">Bitso</span> <span className={dest ? "text-accent" : "text-[#e23b4a]"}>{dest ? "Deposit address saved" : "Not connected"}</span></p>
        <button type="button" onClick={() => document.getElementById("bitso-addr")?.focus()} className="h-10 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold">Connect Bitso</button>
      </div>
      {review ? (
        <div className="rounded-2xl bg-white/[0.04] px-3 py-3 text-sm leading-relaxed">
          {asset === "MXNe"
            ? `Two signatures. Sell ${n || 0} pesos for USDC, then send that USDC to the address you pasted. Bitso credits the dollars. You sell for pesos there.`
            : `One signature. Send ${n || 0} ${asset} on Solana to the address you pasted. About ${mxn > 0 ? pesos(mxn) : "an unknown peso amount"} if Bitso’s book is still there. Not a SPEI.`}
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy || (review && !dest)}
        onClick={() => {
          if (!review) {
            if (!(n > 0)) {
              toast.error("Enter an amount.");
              return;
            }
            setReview(true);
            return;
          }
          void go();
        }}
        className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
      >
        {busy ? "Waiting on the wallet" : review ? (asset === "MXNe" ? "Sign the sale and the send" : `Sign the ${asset} send`) : "Review route"}
      </button>
      {line ? <p className="font-mono text-xs text-white/55">{line}</p> : null}
      <p className="text-xs text-white/40">Bitso credits USDC and SOL on Solana. It does not credit MXNe, so pesos are sold first. MXNB is a different token, on Arbitrum. The ID check, the CURP, and the CLABE stay in Bitso.</p>
      <OutRails owner={owner} />
    </div>
  );
}
