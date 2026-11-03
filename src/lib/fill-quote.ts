/** One quote path for Trade, Markets, and agents. The API answers before a wallet is asked to sign. */

import { quoteJup, USDC } from "@/lib/jup-exec";
import { quoteRoute } from "@/lib/jup-sign";
import { mintDecimals } from "@/lib/phantom";

export type FillPreview = {
  outUi: number;
  impact: number;
  route: string;
  line: string;
  minOut: number;
  hops: number;
};

function impactPct(raw: string | number | null | undefined) {
  const n = Math.abs(Number(raw) || 0);
  return n > 1 ? n : n * 100;
}

export async function previewFill(input: {
  mint: string;
  side: "buy" | "sell";
  usd: number;
  price?: number;
  symbol?: string;
}): Promise<FillPreview> {
  if (!(input.usd > 0)) throw new Error("Enter an amount.");
  if (input.mint.length < 32) throw new Error("That name has no on-chain mint.");
  const symbol = input.symbol || "the token";
  if (input.side === "buy") {
    const q = await quoteJup({ data: { mint: input.mint, usd: input.usd, side: "buy" } });
    if ("error" in q) throw new Error(q.error);
    const decimals = await mintDecimals(input.mint).catch(() => 6);
    const outUi = Number(q.outAmount) / 10 ** decimals;
    const minOut = Number(q.otherAmountThreshold) / 10 ** decimals;
    const impact = impactPct(q.priceImpactPct);
    const route = q.route.filter(Boolean).join(" → ") || "Jupiter";
    const hops = q.route.filter(Boolean).length || 1;
    return {
      outUi,
      minOut,
      hops,
      impact,
      route,
      line: `$${input.usd} buys ${outUi > 0 ? outUi.toPrecision(4) : "—"} ${symbol} · floor ${minOut > 0 ? minOut.toPrecision(4) : "—"} · ${impact.toFixed(2)}% · ${hops} pool${hops === 1 ? "" : "s"} · ${route}`,
    };
  }
  const decimals = await mintDecimals(input.mint).catch(() => 6);
  const px = input.price ?? 0;
  const tokens = px > 0 ? input.usd / px : 0;
  if (!(tokens > 0)) throw new Error("No price, so the sell size cannot be quoted.");
  const quoted = await quoteRoute({
    inputMint: input.mint,
    outputMint: USDC,
    amountRaw: Math.max(1, Math.floor(tokens * 10 ** decimals)),
    outDecimals: 6,
  });
  return {
    outUi: quoted.outUi,
    minOut: quoted.minUi,
    hops: quoted.route.split("→").filter((p) => p.trim()).length || 1,
    impact: quoted.impact,
    route: quoted.route,
    line: `Sell ~$${input.usd} ${symbol} → $${quoted.outUi.toFixed(2)} USDC · floor $${quoted.minUi.toFixed(2)} · ${quoted.impact.toFixed(2)}% · ${quoted.route}`,
  };
}
