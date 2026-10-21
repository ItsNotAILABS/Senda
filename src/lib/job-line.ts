/**
 * A job is one name, one size, then a route, then a signature.
 * The line runs the route before anyone is asked to sign.
 */

import { acceptQuote, acceptSize } from "@/lib/engine";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute } from "@/lib/jup-sign";
import { spendCap } from "@/lib/spend-cap";

const KEY = "senda.jobs.v1";

export type JobStep = "book" | "quoted" | "blocked" | "signing" | "signed" | "failed";

export type Job = {
  id: string;
  symbol: string;
  mint: string;
  usd: number;
  side: "buy" | "sell";
  step: JobStep;
  outUi: number | null;
  minUi: number | null;
  impact: number | null;
  route: string;
  why: string;
  signature: string;
  at: string;
};

function load(): Job[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Job[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: Job[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 24)));
  } catch {
    /* quota */
  }
}

export function listJobs(): Job[] {
  return load();
}

export function addJob(input: { symbol: string; mint: string; usd: number; side?: "buy" | "sell" }): Job {
  const row: Job = {
    id: `job${Math.random().toString(36).slice(2, 8)}`,
    symbol: input.symbol,
    mint: input.mint,
    usd: Math.max(1, Math.round(input.usd) || 25),
    side: input.side ?? "buy",
    step: "book",
    outUi: null,
    minUi: null,
    impact: null,
    route: "",
    why: "",
    signature: "",
    at: new Date().toISOString(),
  };
  const next = [row, ...load()];
  save(next);
  return row;
}

export function patchJob(id: string, patch: Partial<Job>): Job[] {
  const next = load().map((j) => (j.id === id ? { ...j, ...patch, id } : j));
  save(next);
  return next;
}

export function dropJob(id: string): Job[] {
  const next = load().filter((j) => j.id !== id);
  save(next);
  return next;
}

/** Ask Jupiter. The job stays blocked until the route clears the same gate as a buy. */
export async function quoteJob(job: Job): Promise<Job> {
  if (job.side !== "buy") {
    return { ...job, step: "quoted", why: "", route: "Sell uses the tokens already in the wallet." };
  }
  try {
    const q = await quoteRoute({
      inputMint: USDC,
      outputMint: job.mint,
      amountRaw: Math.max(1, Math.round(job.usd * 1e6)),
      outDecimals: 9,
    });
    const size = acceptSize(job.usd, spendCap());
    const gate = acceptQuote(q);
    const why = !size.ok ? size.reason : !gate.ok ? gate.reason : "";
    return {
      ...job,
      step: why ? "blocked" : "quoted",
      outUi: q.outUi,
      minUi: q.minUi,
      impact: q.impact,
      route: q.route,
      why,
    };
  } catch (e) {
    return {
      ...job,
      step: "failed",
      why: e instanceof Error ? e.message : "No route.",
    };
  }
}

/** Quote every job that has not been signed, one at a time. */
export async function runLine(jobs: Job[]): Promise<Job[]> {
  const next = jobs.slice();
  for (let i = 0; i < next.length; i += 1) {
    const job = next[i];
    if (job.step === "signed" || job.step === "signing") continue;
    if (!job.mint || job.mint.length < 32) {
      next[i] = { ...job, step: "failed", why: "That name has no mint." };
      continue;
    }
    next[i] = await quoteJob(job);
  }
  save(next);
  return next;
}
