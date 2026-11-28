/** The agent runs in the browser. The server never receives a key. These checks run before Phantom is asked. */

import { spendCap } from "@/lib/spend-cap";

const VEL = "senda.sign.velocity";
const HOUR = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

function recentSigns(): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(VEL) || "[]") as unknown;
    const now = Date.now();
    return Array.isArray(raw) ? raw.filter((t): t is number => typeof t === "number" && now - t < HOUR) : [];
  } catch {
    return [];
  }
}

export function assertAgentBox(input: { usd: number; mint: string; allowed: string[]; cap?: number; velocity?: boolean }) {
  const cap = Math.min(spendCap(), input.cap ?? Number.POSITIVE_INFINITY);
  if (!(input.usd > 0)) throw new Error("The risk gate cut this to nothing.");
  if (!Number.isFinite(cap) || input.usd - cap > 0.001) {
    throw new Error(`That is $${input.usd.toFixed(2)}. The cap is $${Number.isFinite(cap) ? cap.toFixed(2) : "0"}. Nothing was signed.`);
  }
  if (input.mint.length < 32) throw new Error("That name is not on the book.");
  if (input.allowed.length > 0 && !input.allowed.includes(input.mint)) {
    throw new Error("That token is outside this agent's list. Nothing was signed.");
  }
  if (!input.velocity) return;
  const stamps = recentSigns();
  if (stamps.length >= MAX_PER_HOUR) {
    throw new Error("Five spoken orders already signed this hour. Nothing was signed.");
  }
  stamps.push(Date.now());
  try {
    localStorage.setItem(VEL, JSON.stringify(stamps));
  } catch {
    /* The in-memory count for this call already passed. */
  }
}
