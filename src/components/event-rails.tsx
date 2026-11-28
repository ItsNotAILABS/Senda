import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookLine } from "@/components/book-line";
import { WuDesk } from "@/components/wu-desk";
import { checkBook, type BookVerdict } from "@/lib/book-check";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute, signRoute } from "@/lib/jup-sign";
import { readMintFlags } from "@/lib/mint-flags";
import { connectPhantom } from "@/lib/phantom";
import { payToken } from "@/lib/solana-pay";
import { spendCap } from "@/lib/spend-cap";
import { pickUsdpt, poolNote, USDPT, type UsdptLive } from "@/lib/usdpt";
import { useWalletCtx } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const SIZES = ["1", "5"] as const;

function money(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function EventRails() {
  const wallet = useWalletCtx();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [snap, setSnap] = useState<UsdptLive | null>(null);
  const [miss, setMiss] = useState("Reading the Western Union mint.");
  const [usd, setUsd] = useState("1");
  const [outUi, setOutUi] = useState(0);
  const [verdict, setVerdict] = useState<BookVerdict | null>(null);
  const [quoteLine, setQuoteLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let live = true;
    fetch("https://lite-api.jup.ag/tokens/v2/search?query=USDPT")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Jupiter did not list USDPT."))))
      .then((rows) => {
        if (!live) return;
        const next = pickUsdpt(rows);
        setSnap(next);
        setMiss(next ? "" : "Jupiter did not return the verified USDPT mint.");
      })
      .catch(() => live && setMiss("Jupiter did not list USDPT."));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const amount = Number(usd);
    if (!(amount > 0)) return;
    let live = true;
    setVerdict(null);
    setQuoteLine("Asking Jupiter.");
    quoteRoute({ inputMint: USDC, outputMint: USDPT, amountRaw: Math.round(amount * 1_000_000), outDecimals: 6 })
      .then(async (q) => {
        if (!live) return;
        const flags = await readMintFlags(USDPT);
        if (!live) return;
        const next = checkBook({
          inMint: USDC,
          outMint: USDPT,
          inRaw: q.inAmount,
          outRaw: q.outAmount,
          minRaw: q.otherAmountThreshold || q.outAmount,
          inDecimals: 6,
          outDecimals: 6,
          impactPct: q.impact,
          slippageBps: 100,
          shownIn: amount,
          mark: 1,
          symbol: "USDPT",
          paused: flags.paused,
          frozenDefault: flags.frozenDefault,
          fees: flags.fees,
        });
        setOutUi(q.outUi);
        setVerdict(next);
        setQuoteLine("");
      })
      .catch((error: unknown) => {
        if (!live) return;
        setOutUi(0);
        setVerdict(null);
        setQuoteLine(error instanceof Error ? error.message : "Jupiter did not quote.");
      });
    return () => {
      live = false;
    };
  }, [usd]);

  async function sendHeld() {
    const amount = Number(held);
    if (!(amount > 0) || !to.trim()) return;
    const cap = spendCap();
    if (amount > cap) {
      toast.error(`That is about $${amount.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.`);
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      const done = await payToken({ owner: who, to: to.trim(), mint: USDPT, symbol: "USDPT", amount, decimals: 6 });
      toast.success(`USDPT sent. ${done.signature.slice(0, 8)}…`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  async function swap() {
    const amount = Number(usd);
    if (!verdict?.ok || !(amount > 0)) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      const done = await signRoute({
        owner: who,
        inputMint: USDC,
        outputMint: USDPT,
        amountRaw: Math.round(amount * 1_000_000),
        outDecimals: 6,
        usd: amount,
        symbol: "USDPT",
        refPrice: 1,
      });
      toast.success(`${done.outUi.toFixed(2)} USDPT is in this Phantom.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nothing was signed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 pb-28 lg:pb-4">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Breakpoint · 16 Nov</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Cash on Solana</h1>
        <p className="mt-2 text-sm leading-snug text-white/60">
          Western Union’s dollar is a live mint. MoneyGram’s cash-out is live inside Solflare. Zelle showed a confidential transfer and has not shipped a mainnet coin. This phone only signs what the book clears.
        </p>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Western Union</h2>
          <span className="text-[11px] tracking-[0.14em] text-white/40 uppercase">USDPT</span>
        </div>
        <p className="mt-2 text-sm leading-snug text-white/60">
          Issued by Anchorage Digital Bank. Visa can settle VisaNet in it. That settlement is their network, not a charge here. Cash at a counter is still their map, not a pickup code from this screen.
        </p>
        {miss ? <p className="mt-3 text-sm text-white/50">{miss}</p> : null}
        {snap ? (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["Supply", money(snap.supply)],
              ["Holders", money(snap.holders)],
              ["Jupiter", `$${snap.price.toFixed(4)}`],
              ["Peg", "$1.00"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-black/30 px-3 py-2">
                <dt className="text-[11px] text-white/40">{k}</dt>
                <dd className="font-mono text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {snap ? <p className="mt-2 text-sm text-white/55">{poolNote(snap.liquidity)}</p> : null}
        <div className="mt-3 flex gap-2">
          {SIZES.map((n) => (
            <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "bg-white/10")}>
              ${n}
            </button>
          ))}
        </div>
        <p className="mt-2 font-mono text-sm text-white/70">{outUi > 0 ? `${outUi.toFixed(2)} USDPT` : "—"}</p>
        {quoteLine ? <p className="mt-1 text-sm text-white/50">{quoteLine}</p> : null}
        {verdict ? <BookLine ok={verdict.ok} line={verdict.line} warn={verdict.warn} /> : null}
        <button type="button" disabled={busy || !verdict?.ok} onClick={() => void swap()} className="mt-3 min-h-12 w-full rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-40">
          {busy ? "Waiting on Phantom" : "Sign USDPT"}
        </button>
        <p className="mt-4 text-sm leading-snug text-white/60">Already holding it? Send it to another Solana address. That does not buy from the pool.</p>
        <input value={held} onChange={(e) => setHeld(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="USDPT to send" className="mt-2 min-h-12 w-full rounded-2xl bg-black/30 px-4 font-mono text-sm outline-none" />
        <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Their Solana address" spellCheck={false} className="min-h-12 w-full rounded-2xl bg-black/30 px-4 font-mono text-xs outline-none" />
        <button type="button" disabled={busy || !(Number(held) > 0) || !to} onClick={() => void sendHeld()} className="min-h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
          {busy ? "Waiting on Phantom" : "Send USDPT"}
        </button>
        <WuDesk />
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">MoneyGram</h2>
          <span className="text-[11px] tracking-[0.14em] text-white/40 uppercase">USDC</span>
        </div>
        <p className="mt-2 text-sm leading-snug text-white/60">
          Eligible Solflare users can cash USDC at participating locations in 170 countries. The $0 fee runs through 31 Dec 2026. The pickup starts in Solflare: Withdraw, then MoneyGram. Senda does not hold a Ramps key, so this screen does not print a reference number.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href="https://solflare.com" target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
            Open Solflare
          </a>
          <a href="https://www.moneygram.com" target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
            MoneyGram
          </a>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg font-semibold">Still early</h2>
        <ul className="mt-2 space-y-2 text-sm leading-snug text-white/60">
          <li>Zelle moved $1.25M of ZelleUSD on a confidential devnet transfer. No mainnet mint is published.</li>
          <li>MXNB is on Solana and the supply is still zero. No SPEI from this phone.</li>
        </ul>
        <div className="mt-3 flex gap-2">
          <Link to="/payments/zelle" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
            Zelle drill
          </Link>
          <Link to="/payments/mexico" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
            Peso
          </Link>
        </div>
      </section>
    </div>
  );
}
