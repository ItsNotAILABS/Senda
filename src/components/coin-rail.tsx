import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookLine } from "@/components/book-line";
import { checkBook, type BookVerdict } from "@/lib/book-check";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute, signRoute } from "@/lib/jup-sign";
import { kaminoMarkets, type KaminoReserve } from "@/lib/kamino-lend";
import { readMintFlags } from "@/lib/mint-flags";
import { connectPhantom } from "@/lib/phantom";
import { useWalletCtx } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const SIZES = ["10", "25"] as const;

/** A Jupiter buy of the coin you opened, plus the Kamino supply market if that mint has one. */
export function CoinRail({ mint, symbol, price, decimals }: { mint: string; symbol: string; price: number; decimals: number }) {
  const wallet = useWalletCtx();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [usd, setUsd] = useState("10");
  const [outUi, setOutUi] = useState(0);
  const [verdict, setVerdict] = useState<BookVerdict | null>(null);
  const [line, setLine] = useState("");
  const [reserve, setReserve] = useState<KaminoReserve | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    kaminoMarkets()
      .then((rows) => {
        if (!live) return;
        const hits = rows.filter((row) => row.mint === mint && row.supplyApy >= 0.005);
        hits.sort((a, b) => b.totalSupplyUsd - a.totalSupplyUsd);
        setReserve(hits[0] ?? null);
      })
      .catch(() => live && setReserve(null));
    return () => {
      live = false;
    };
  }, [mint]);

  useEffect(() => {
    const amount = Number(usd);
    if (!(amount > 0) || mint === USDC) return;
    let live = true;
    setVerdict(null);
    setLine("Asking Jupiter.");
    const dec = decimals > 0 && decimals <= 12 ? decimals : 6;
    quoteRoute({ inputMint: USDC, outputMint: mint, amountRaw: Math.round(amount * 1_000_000), outDecimals: dec })
      .then(async (q) => {
        if (!live) return;
        const flags = await readMintFlags(mint);
        if (!live) return;
        const next = checkBook({
          inMint: USDC,
          outMint: mint,
          inRaw: q.inAmount,
          outRaw: q.outAmount,
          minRaw: q.otherAmountThreshold || q.outAmount,
          inDecimals: 6,
          outDecimals: flags.ok && flags.decimals > 0 ? flags.decimals : dec,
          impactPct: q.impact,
          slippageBps: 100,
          shownIn: amount,
          mark: price > 0 ? price : undefined,
          symbol,
          paused: flags.paused,
          frozenDefault: flags.frozenDefault,
          fees: flags.fees,
        });
        const decShown = flags.ok && flags.decimals > 0 ? flags.decimals : dec;
        setOutUi(Number(q.outAmount) / 10 ** decShown);
        setVerdict(next);
        setLine("");
      })
      .catch((error: unknown) => {
        if (!live) return;
        setOutUi(0);
        setVerdict(null);
        setLine(error instanceof Error ? error.message : "Jupiter did not quote.");
      });
    return () => {
      live = false;
    };
  }, [mint, usd, price, symbol, decimals]);

  async function buy() {
    const amount = Number(usd);
    if (!verdict?.ok || !(amount > 0)) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      const dec = decimals > 0 && decimals <= 12 ? decimals : 6;
      const flags = await readMintFlags(mint);
      const done = await signRoute({
        owner: who,
        inputMint: USDC,
        outputMint: mint,
        amountRaw: Math.round(amount * 1_000_000),
        outDecimals: flags.ok && flags.decimals > 0 ? flags.decimals : dec,
        usd: amount,
        symbol,
        refPrice: price > 0 ? price : undefined,
      });
      toast.success(`${done.outUi.toFixed(4)} ${symbol} is in this Phantom.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nothing was signed.");
    } finally {
      setBusy(false);
    }
  }

  if (mint === USDC) return null;

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Solana</p>
      <p className="mt-1 text-sm leading-snug text-white/60">USDC into {symbol} on Jupiter. The wallet signs only if this quote clears.</p>
      <div className="mt-3 flex gap-2">
        {SIZES.map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "bg-white/10")}>
            ${n}
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-sm text-white/70">{outUi > 0 ? `${outUi < 1 ? outUi.toPrecision(4) : outUi.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${symbol}` : "—"}</p>
      {line ? <p className="mt-1 text-sm text-white/50">{line}</p> : null}
      {verdict ? <BookLine ok={verdict.ok} line={verdict.line} warn={verdict.warn} /> : null}
      <button type="button" disabled={busy || !verdict?.ok} onClick={() => void buy()} className="mt-3 min-h-12 w-full rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-40">
        {busy ? "Waiting on Phantom" : `Buy ${symbol}`}
      </button>
      {reserve ? (
        <p className="mt-3 text-sm leading-snug text-white/60">
          Kamino pays {(reserve.supplyApy * 100).toFixed(2)}% to supply {reserve.symbol}
          {reserve.totalSupplyUsd > 0 ? `, on $${Math.round(reserve.totalSupplyUsd).toLocaleString("en-US")} supplied` : ""}. That deposit is a different signature.
        </p>
      ) : (
        <p className="mt-3 text-sm text-white/45">No Kamino supply market on this mint.</p>
      )}
      {reserve ? (
        <Link to="/invest" search={{ desk: "loans" }} className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-[#c6f56a]">
          Open the lend desk
        </Link>
      ) : null}
    </section>
  );
}
