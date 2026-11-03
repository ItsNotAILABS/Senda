/** The agent runs in the browser. This is the box. The server never receives a key or a standing allowance. */

import { spendCap } from "@/lib/spend-cap";

export function assertAgentBox(input: { usd: number; mint: string; allowed: string[]; cap?: number }) {
  const cap = Math.min(spendCap(), input.cap ?? Number.POSITIVE_INFINITY);
  if (!(input.usd > 0)) throw new Error("The risk gate cut this to nothing.");
  if (!Number.isFinite(cap) || input.usd - cap > 0.001) {
    throw new Error(`That is $${input.usd.toFixed(2)}. The cap is $${Number.isFinite(cap) ? cap.toFixed(2) : "0"}. Nothing was signed.`);
  }
  if (input.mint.length < 32) throw new Error("That name is not on the book.");
  if (input.allowed.length > 0 && !input.allowed.includes(input.mint)) {
    throw new Error("That token is outside this agent's list. Nothing was signed.");
  }
}
