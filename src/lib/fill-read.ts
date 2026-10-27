/** Whether a limit can meet the market. It does not move the order and it does not invent a fill. */

export function fillRead(input: { side: "buy" | "sell"; limit: number; mark: number }): { state: "through" | "near" | "rest"; gapBps: number; line: string } {
  const { side, limit, mark } = input;
  if (!(limit > 0) || !(mark > 0)) {
    return { state: "rest", gapBps: 0, line: "No live mark, so this cannot say if the order can fill." };
  }
  const gapBps = ((limit - mark) / mark) * 10_000;
  const abs = Math.abs(gapBps);
  if (side === "buy" && limit >= mark) {
    return { state: "through", gapBps, line: `Buy is ${abs.toFixed(1)} bps through the mark. Jupiter can match it. It is not a patient bid.` };
  }
  if (side === "sell" && limit <= mark) {
    return { state: "through", gapBps, line: `Sell is ${abs.toFixed(1)} bps through the mark. Jupiter can match it. It is not a patient offer.` };
  }
  if (abs <= 8) {
    return { state: "near", gapBps, line: `${abs.toFixed(1)} bps from the mark. A print through this price is what fills it. Refresh does not fill it.` };
  }
  return { state: "rest", gapBps, line: `${abs.toFixed(0)} bps from the mark. It rests until the market trades through. Nothing here chases it.` };
}
