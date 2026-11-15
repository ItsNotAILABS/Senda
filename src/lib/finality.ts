/** What this RPC just measured, and whether a signature is final. Not a 150 ms promise. */

import { createServerFn } from "@tanstack/react-start";
import { chainRpc } from "@/lib/phantom";

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

export const CHAIN_MARKS = [
  { id: "ring", label: "Privacy Rings", address: "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW" },
  { id: "registry", label: "Privacy registry", address: "regy3WAeRXMYuMYxr5iK3Bf9Arr3PcxGxyzAddbiqDQ" },
  { id: "tree", label: "Privacy tree", address: "777pvSGe5LaBd9nCczvE2FXEauiwtfGJ5XRpjKyniGor" },
  { id: "dvp", label: "DvP", address: "dvp34bdbcEm4f4FCUjGV4mDAkDshaQR4LkK8fdcsyZq" },
] as const;

export type ChainMark = {
  id: string;
  label: string;
  address: string;
  present: boolean;
  executable: boolean;
  owner: string;
};

export type ChainStack = {
  slotMs: number | null;
  samples: number;
  spread: SlotSpread | null;
  marks: ChainMark[];
};

export type SlotBar = { ms: number; n: number };

export type SlotSpread = {
  n: number;
  min: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  bars: SlotBar[];
};

type Sample = { numSlots?: number; samplePeriodSecs?: number };

/** Nearest-rank slot time. A sample with no slots is dropped. p50 is the headline, not a promise of finality. */
export function slotSpread(samples: Sample[]): SlotSpread | null {
  const ms = samples
    .map((row) => {
      const slots = Number(row.numSlots);
      const secs = Number(row.samplePeriodSecs);
      if (!(slots > 0) || !(secs > 0)) return null;
      return Math.round((secs * 1000) / slots);
    })
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
  if (!ms.length) return null;
  const at = (p: number) => ms[Math.min(ms.length - 1, Math.max(0, Math.ceil((p / 100) * ms.length) - 1))] ?? ms[0]!;
  const buckets = new Map<number, number>();
  for (const n of ms) {
    const bucket = Math.floor(n / 10) * 10;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  return {
    n: ms.length,
    min: ms[0]!,
    p50: at(50),
    p90: at(90),
    p99: at(99),
    max: ms[ms.length - 1]!,
    bars: [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([bucket, n]) => ({ ms: bucket, n })),
  };
}

export function slotMillis(samples: Sample[]): number | null {
  return slotSpread(samples)?.p50 ?? null;
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = "RPC failed";
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (!res.ok || body.error) {
        last = body.error?.message || `RPC ${res.status}`;
        continue;
      }
      return body.result;
    } catch (e) {
      last = e instanceof Error ? e.message : last;
    }
  }
  throw new Error(last);
}

export async function fetchChainStack(): Promise<ChainStack> {
  const [samples, accounts] = await Promise.all([
    rpc("getRecentPerformanceSamples", [120]) as Promise<Sample[] | null>,
    rpc("getMultipleAccounts", [CHAIN_MARKS.map((row) => row.address), { encoding: "base64" }]) as Promise<{
      value?: Array<{ executable?: boolean; owner?: string } | null>;
    } | null>,
  ]);
  const rows = Array.isArray(samples) ? samples : [];
  const values = accounts?.value ?? [];
  const spread = slotSpread(rows);
  return {
    slotMs: spread?.p50 ?? null,
    samples: spread?.n ?? rows.length,
    spread,
    marks: CHAIN_MARKS.map((row, i) => {
      const account = values[i];
      return {
        id: row.id,
        label: row.label,
        address: row.address,
        present: Boolean(account),
        executable: Boolean(account?.executable),
        owner: String(account?.owner || ""),
      };
    }),
  };
}

export const readChainStack = createServerFn({ method: "GET" }).handler(async () => fetchChainStack());

export type FinalWatch = { state: "final" | "seen" | "rejected" | "open"; ms: number };

export function finalLine(row: FinalWatch): string {
  if (row.state === "final") return `Final in ${row.ms} ms. That clock is this send, not a 150 ms promise.`;
  if (row.state === "rejected") return "The chain rejected the transaction.";
  if (row.state === "seen") return `Signed and seen. Not final after ${row.ms} ms. Do not send it again.`;
  return "Signed. The chain has not reported it. Do not send it again.";
}

/** Poll until finalized, or until the budget. Processed is not final. */
export async function watchFinal(signature: string, budgetMs = 8000): Promise<FinalWatch> {
  const start = Date.now();
  let seen = false;
  while (Date.now() - start < budgetMs) {
    try {
      const result = (await chainRpc("getSignatureStatuses", [[signature]])) as {
        value?: Array<{ err?: unknown; confirmationStatus?: string } | null>;
      };
      const row = result?.value?.[0];
      if (row?.err) return { state: "rejected", ms: Date.now() - start };
      const status = row?.confirmationStatus;
      if (status === "finalized") return { state: "final", ms: Date.now() - start };
      if (status === "processed" || status === "confirmed") seen = true;
    } catch {
      /* the next poll asks again */
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return { state: seen ? "seen" : "open", ms: Date.now() - start };
}
