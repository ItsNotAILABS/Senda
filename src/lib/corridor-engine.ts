/** Live prints in, Python shear router out. No payout is invented. */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CCY = ["MXN", "BRL", "EUR", "GBP", "PHP", "INR"] as const;
export type CorridorCcy = (typeof CCY)[number];

const Ask = z.object({
  usd: z.number().positive().max(5000),
  currency: z.enum(CCY),
  accept: z.enum(["usdc", "card"]),
  cardBps: z.number().int().min(0).max(300),
  cardCap: z.number().positive().max(5000).nullable(),
});

export type CorridorSlice = {
  id: string;
  label: string;
  usd: string;
  local: string;
  spreadBps: number;
  kind: string;
  note: string;
};

export type CorridorPlan = {
  ok: true;
  engine: "python" | "node";
  currency: string;
  usd: string;
  planningRate: string;
  prints: { id: string; label: string; rate: string; asOf: string; kept: boolean }[];
  printShearBps: string | null;
  winner: CorridorSlice | null;
  received: string;
  slices: CorridorSlice[];
  uncovered: string;
  ranked: {
    id: string;
    label: string;
    local: string | null;
    usd: string;
    spreadBps: number;
    kind: string;
    note: string;
    capped: boolean;
  }[];
  railShearBps: string | null;
  breakpointUsd: string | null;
  split: "single" | "capped";
  proof: string;
  ladder: { spreadBps: number; local: string | null; gap: string | null }[];
  accept: string;
};

type Rate = { rate: string; asOf: string };
type Payload = {
  usd: string;
  currency: string;
  accept: string;
  prints: { id: string; label: string; rate: string; asOf: string }[];
  rails: { id: string; label: string; fixed: string; spreadBps: number; lo: string; hi: null; kind: "live"; note: string }[];
  card: { spreadBps: number; fixed: string; cap: string | null };
};

let bag: { at: number; fx: Record<string, Rate>; bitso: Record<string, Rate>; fix: Rate | null; circle: { fast: number; standard: number } | null } | null = null;

async function pull(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function num(value: unknown): string | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!(n > 0) || !Number.isFinite(n)) return null;
  return String(value);
}

async function loadBag() {
  if (bag && Date.now() - bag.at < 60_000) return bag;
  const fx: Record<string, Rate> = {};
  const bitso: Record<string, Rate> = {};
  let fix: Rate | null = null;
  let circle: { fast: number; standard: number } | null = null;
  const [fxBody, mxnBook, brlBook, fixBody, feeBody] = await Promise.all([
    pull("https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,GBP,MXN,BRL,PHP,INR"),
    pull("https://api.bitso.com/v3/ticker/?book=usd_mxn"),
    pull("https://api.bitso.com/v3/ticker/?book=usd_brl"),
    pull("https://api.frankfurter.dev/v2/providers/banxico/rates?base=USD&quotes=MXN"),
    pull("https://iris-api.circle.com/v2/burn/USDC/fees/5/6"),
  ]);
  if (fxBody) {
    try {
      const rows = JSON.parse(fxBody) as { quote?: string; rate?: number; date?: string }[];
      for (const row of rows) {
        const rate = num(row.rate);
        if (!row.quote || !rate) continue;
        fx[row.quote] = { rate, asOf: row.date || "" };
      }
    } catch {
      /* refuse later if the currency is missing */
    }
  }
  const takeBid = (body: string | null, key: string) => {
    if (!body) return;
    try {
      const row = JSON.parse(body) as { payload?: { bid?: string; created_at?: string } };
      const rate = num(row.payload?.bid);
      if (!rate) return;
      bitso[key] = { rate, asOf: row.payload?.created_at || "" };
    } catch {
      /* skip a book that did not answer */
    }
  };
  takeBid(mxnBook, "MXN");
  takeBid(brlBook, "BRL");
  if (fixBody) {
    try {
      const rows = JSON.parse(fixBody) as { rate?: number; date?: string }[];
      const row = Array.isArray(rows) ? rows[0] : null;
      const rate = num(row?.rate);
      if (rate) fix = { rate, asOf: row?.date || "" };
    } catch {
      fix = null;
    }
  }
  if (feeBody) {
    try {
      const rows = JSON.parse(feeBody) as { finalityThreshold?: number; minimumFee?: number }[];
      const fast = rows.find((row) => row.finalityThreshold === 1000)?.minimumFee;
      const standard = rows.find((row) => row.finalityThreshold === 2000)?.minimumFee;
      if (typeof fast === "number" && typeof standard === "number") circle = { fast, standard };
    } catch {
      circle = null;
    }
  }
  bag = { at: Date.now(), fx, bitso, fix, circle };
  return bag;
}

function pyRoot(): string | null {
  const roots = [join(process.cwd(), "py"), "/workspace/py"];
  return roots.find((dir) => existsSync(join(dir, "senda_corridor", "engine.py"))) ?? null;
}

function runPython(payload: Payload): Promise<Omit<CorridorPlan, "engine">> {
  const root = pyRoot();
  if (!root) return Promise.reject(new Error("no python"));
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-m", "senda_corridor.engine"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("timeout"));
    }, 4000);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(Buffer.concat(err).toString().slice(0, 180) || "engine failed"));
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(out).toString()) as { ok: boolean; error?: string };
        if (!parsed.ok) {
          reject(new Error(parsed.error || "The corridor did not price."));
          return;
        }
        resolve(parsed as Omit<CorridorPlan, "engine">);
      } catch {
        reject(new Error("bad engine output"));
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function round2(n: number): string {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function priceOnHost(payload: Payload): CorridorPlan {
  const usd = Number(payload.usd);
  const rates = payload.prints.map((p) => ({ ...p, n: Number(p.rate) })).filter((p) => p.n > 0);
  const med = median(rates.map((p) => p.n));
  const mad = median(rates.map((p) => Math.abs(p.n - med)));
  const band = Math.max(mad * 3, med * 0.005);
  const kept = rates.filter((p) => Math.abs(p.n - med) <= band);
  const use = kept.length ? kept : rates;
  const planning = median(use.map((p) => p.n));
  const rows = payload.accept === "card"
    ? [{ id: "card", label: "Card scenario", spreadBps: payload.card.spreadBps, hi: payload.card.cap ? Number(payload.card.cap) : null, kind: "scenario", note: "Assumed issuer spread. Not a quote from an issuer.", fixed: 0 }]
    : payload.rails.map((r) => ({ id: r.id, label: r.label, spreadBps: r.spreadBps, hi: null as number | null, kind: r.kind, note: r.note, fixed: Number(r.fixed || 0) }));
  const ordered = [...rows].sort((a, b) => a.spreadBps - b.spreadBps || a.fixed - b.fixed || (a.id === "solana" ? -1 : 1));
  let left = usd;
  const slices: CorridorSlice[] = [];
  for (const rail of ordered) {
    if (left <= 0) break;
    const room = rail.hi == null ? left : Math.min(left, rail.hi);
    if (!(room > rail.fixed)) continue;
    slices.push({
      id: rail.id,
      label: rail.label,
      usd: round2(room),
      local: round2((room - rail.fixed) * planning * (1 - rail.spreadBps / 10_000)),
      spreadBps: rail.spreadBps,
      kind: rail.kind,
      note: rail.note,
    });
    left -= room;
  }
  const ranked = [...ordered]
    .map((rail) => {
      const amount = rail.hi != null && usd > rail.hi ? rail.hi : usd;
      const local = amount > rail.fixed ? (amount - rail.fixed) * planning * (1 - rail.spreadBps / 10_000) : null;
      return {
        id: rail.id,
        label: rail.label,
        local: local == null ? null : round2(local),
        usd: round2(amount),
        spreadBps: rail.spreadBps,
        kind: rail.kind,
        note: rail.note,
        capped: rail.hi != null && usd > rail.hi,
      };
    })
    .sort((a, b) => Number(b.local ?? -1) - Number(a.local ?? -1));
  const usdc = usd * planning;
  return {
    ok: true,
    engine: "node",
    currency: payload.currency,
    usd: round2(usd),
    planningRate: String(Math.round(planning * 1e6) / 1e6),
    prints: rates.map((p) => ({ id: p.id, label: p.label, rate: p.rate, asOf: p.asOf, kept: use.some((row) => row.id === p.id) })),
    printShearBps: null,
    winner: slices[0] ?? null,
    received: round2(slices.reduce((sum, row) => sum + Number(row.local), 0)),
    slices,
    uncovered: round2(Math.max(0, left)),
    ranked,
    railShearBps: null,
    breakpointUsd: null,
    split: slices.length > 1 || left > 0.004 ? "capped" : "single",
    proof: "Priced on this host because Python was not available. Same schedule.",
    ladder: [50, 100, 200].map((step) => {
      const local = usd * planning * (1 - step / 10_000);
      return { spreadBps: step, local: round2(local), gap: round2(usdc - local) };
    }),
    accept: payload.accept,
  };
}

export const routeCorridor = createServerFn({ method: "POST" })
  .validator((input: unknown) => Ask.parse(input))
  .handler(async ({ data }): Promise<CorridorPlan> => {
    const live = await loadBag();
    const mid = live.fx[data.currency];
    if (!mid) throw new Error(`No ECB print for ${data.currency}.`);
    const prints: Payload["prints"] = [{ id: "ecb", label: "ECB mid", rate: mid.rate, asOf: mid.asOf }];
    const venue = live.bitso[data.currency];
    if (venue) prints.push({ id: "bitso", label: "Bitso bid", rate: venue.rate, asOf: venue.asOf });
    if (data.currency === "MXN" && live.fix) prints.push({ id: "banxico", label: "Banxico FIX", rate: live.fix.rate, asOf: live.fix.asOf });
    const rails: Payload["rails"] = [
      {
        id: "solana",
        label: "USDC on Solana",
        fixed: "0",
        spreadBps: 0,
        lo: "1",
        hi: null,
        kind: "live",
        note: "They receive USDC. The local figure is the planning mid, not a bank deposit.",
      },
    ];
    if (live.circle) {
      rails.push({
        id: "cctp-std",
        label: "CCTP standard to Base",
        fixed: "0",
        spreadBps: live.circle.standard,
        lo: "1",
        hi: null,
        kind: "live",
        note: `Circle minimumFee ${live.circle.standard} bp on a standard burn. Still USDC, on Base.`,
      });
      rails.push({
        id: "cctp-fast",
        label: "CCTP fast to Base",
        fixed: "0",
        spreadBps: live.circle.fast,
        lo: "1",
        hi: null,
        kind: "live",
        note: `Circle minimumFee ${live.circle.fast} bp on a fast burn. Still USDC, on Base.`,
      });
    }
    const payload: Payload = {
      usd: data.usd.toFixed(2),
      currency: data.currency,
      accept: data.accept,
      prints,
      rails,
      card: {
        spreadBps: data.cardBps,
        fixed: "0",
        cap: data.cardCap == null ? null : data.cardCap.toFixed(2),
      },
    };
    try {
      const priced = await runPython(payload);
      return { ...priced, engine: "python" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message && message !== "no python" && message !== "timeout" && message !== "bad engine output" && message !== "engine failed" && !message.startsWith("The corridor")) {
        if (message.includes("amount") || message.includes("currency") || message.includes("no live print") || message.includes("no rail")) throw err;
      }
      return priceOnHost(payload);
    }
  });
