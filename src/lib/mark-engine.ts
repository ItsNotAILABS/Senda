/** One settlement formula. Futures, agents, and the portfolio all read this, so the delta cannot drift. */

export function settlementDelta(input: {
  entry: number;
  mark: number;
  notional: number;
  side: "long" | "short" | "buy" | "sell";
}): { pnl: number; bps: number } | null {
  if (!(input.entry > 0) || !(input.mark > 0) || !(input.notional > 0)) return null;
  const move = (input.mark - input.entry) / input.entry;
  const short = input.side === "short" || input.side === "sell";
  const signed = short ? -move : move;
  return { pnl: input.notional * signed, bps: signed * 10_000 };
}
