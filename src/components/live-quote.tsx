import { useEffect, useState } from "react";
import { acceptQuote, acceptSize } from "@/lib/engine";
import { payAsset, payRaw, quoteRoute, type RouteQuote } from "@/lib/jup-sign";
import { mintDecimals } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";

export function useLiveQuote(mint: string | undefined, usd: number, paySymbol = "USDC", solUsd = 0) {
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [why, setWhy] = useState("Asking for a route.");
  const pay = payAsset(paySymbol);

  useEffect(() => {
    if (!mint || mint.length < 32 || !(usd > 0)) {
      setQuote(null);
      setWhy(!(usd > 0) ? "Enter a size." : "That name has no mint.");
      return;
    }
    if (mint === pay.mint) {
      setQuote(null);
      setWhy(`That is already ${pay.symbol}. Pick another asset to pay with.`);
      return;
    }
    let amountRaw = 0;
    try {
      amountRaw = payRaw(pay.symbol, usd, solUsd);
    } catch (error) {
      setQuote(null);
      setWhy(error instanceof Error ? error.message : "No size.");
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      mintDecimals(mint)
        .catch(() => 9)
        .then((dec) =>
          quoteRoute({
            inputMint: pay.mint,
            outputMint: mint,
            amountRaw,
            outDecimals: dec,
          }),
        )
        .then((q) => {
          if (!live) return;
          const size = acceptSize(usd, spendCap());
          const gate = acceptQuote(q);
          setQuote(q);
          setWhy(!size.ok ? size.reason : !gate.ok ? gate.reason : "");
        })
        .catch((e) => {
          if (!live) return;
          setQuote(null);
          setWhy(e instanceof Error ? e.message : "No route.");
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [mint, usd, pay.mint, pay.symbol, solUsd]);

  return { quote, why, ready: Boolean(quote) && why === "" };
}

export function LiveQuote({
  quote,
  why,
  symbol,
  usd,
  pay = "USDC",
}: {
  quote: RouteQuote | null;
  why: string;
  symbol: string;
  usd: number;
  pay?: string;
}) {
  if (!quote) return <p className="text-xs text-muted">{why || "Asking for a route."}</p>;
  return (
    <div>
      <p className="font-mono text-sm">
        Pay ${usd} of {pay} · get {quote.outUi.toFixed(4)} {symbol}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted">
        Minimum {quote.minUi.toFixed(4)} · impact {quote.impact.toFixed(2)}%
      </p>
      {why ? <p className="mt-1 text-xs text-down">{why}</p> : null}
    </div>
  );
}
