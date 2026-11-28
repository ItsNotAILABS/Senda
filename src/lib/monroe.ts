/** Monroe compares routes. Liquify already chose the size. Phantom still signs a fresh Jupiter build. */

import { monroePick, type MonroeLane, type MonroePick } from "@/lib/floor-mind";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute, type RouteQuote } from "@/lib/jup-sign";

export type MonroeResult = {
  pick: MonroePick;
  /** Lane the signature should prefer. Liquify never builds the swap. */
  onlyDirect: boolean;
  quote: RouteQuote | null;
  note: string;
};

export async function monroeRoute(input: {
  side: "buy" | "sell";
  mint: string;
  amountRaw: number;
  outDecimals: number;
  /** Buy-side Liquify output at the same size, if that row exists. Not used on a sell. */
  liquify?: { outAmount: string; route: string; impact: number | null } | null;
}): Promise<MonroeResult> {
  const inputMint = input.side === "buy" ? USDC : input.mint;
  const outputMint = input.side === "buy" ? input.mint : USDC;
  const lanes: MonroeLane[] = [];
  const quotes = new Map<string, RouteQuote>();
  await Promise.all(
    (
      [
        ["direct", true],
        ["routed", false],
      ] as const
    ).map(async ([id, onlyDirect]) => {
      try {
        const quote = await quoteRoute({
          inputMint,
          outputMint,
          amountRaw: input.amountRaw,
          outDecimals: input.outDecimals,
          onlyDirect,
          slippageBps: 100,
          maxImpact: 8,
        });
        if (!quote.outAmount) return;
        lanes.push({
          id,
          outAmount: quote.outAmount,
          route: onlyDirect ? `Direct · ${quote.route}` : quote.route || "Routed",
          impact: quote.impact,
        });
        quotes.set(id, quote);
      } catch {
        /* this lane did not answer */
      }
    }),
  );
  if (input.side === "buy" && input.liquify?.outAmount) {
    lanes.push({
      id: "liquify",
      outAmount: input.liquify.outAmount,
      route: input.liquify.route || "Liquify",
      impact: input.liquify.impact,
    });
  }
  const pick = monroePick(lanes);
  const jupiter = monroePick(lanes.filter((lane) => lane.id !== "liquify"));
  const signLane = pick.winner?.id === "liquify" ? jupiter.winner : pick.winner;
  const quote = signLane ? (quotes.get(signLane.id) ?? null) : null;
  const liquifyWon = pick.winner?.id === "liquify";
  const note = liquifyWon
    ? `${pick.note} Liquify does not build the swap. The signature uses ${signLane?.route || "Jupiter"}.`
    : pick.note;
  return { pick, onlyDirect: signLane?.id === "direct", quote, note };
}
