/**
 * Clearing math for a signed move. Not a balance.
 * Legs net to a destination. The desk keeps 25 bps, then the rest pays out.
 */

export type ClearLeg = { to: string; usd: number; memo: string };

const FEE_BPS = 25;
const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"] as const;

/** Integer cents. The formula the blotter uses everywhere it rounds money. */
function cents(usd: number): number {
  return Math.round(usd * 100) / 100;
}

/**
 * One leg per destination. Sum, then round to cents.
 * Empty addresses and anything under a cent are not a payment.
 */
export function netLegs(legs: ClearLeg[]): ClearLeg[] {
  const order: string[] = [];
  const bucket = new Map<string, { usd: number; memo: string }>();
  for (const leg of legs) {
    const to = typeof leg.to === "string" ? leg.to.trim() : "";
    if (!to) continue;
    const usd = Number(leg.usd);
    if (!Number.isFinite(usd)) continue;
    const hit = bucket.get(to);
    if (!hit) {
      order.push(to);
      bucket.set(to, { usd, memo: typeof leg.memo === "string" ? leg.memo : "" });
      continue;
    }
    hit.usd += usd;
    if (!hit.memo && leg.memo) hit.memo = leg.memo;
  }
  const out: ClearLeg[] = [];
  for (const to of order) {
    const row = bucket.get(to);
    if (!row) continue;
    const usd = cents(row.usd);
    if (!(usd >= 0.01)) continue;
    out.push({ to, usd, memo: row.memo });
  }
  return out;
}

/**
 * 25 bps. Under $1 the fee is 0.
 * Otherwise the nearest cent, and never outside 1¢–$1.00.
 */
export function feeOf(usd: number): { bps: number; usd: number } {
  if (!Number.isFinite(usd) || usd < 1) return { bps: FEE_BPS, usd: 0 };
  const rawCents = Math.round((usd * FEE_BPS) / 100);
  const clamped = Math.min(100, Math.max(1, rawCents));
  return { bps: FEE_BPS, usd: clamped / 100 };
}

/** What the destination receives. Never negative. Cents. */
export function payoutAfterFee(usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  const net = usd - feeOf(usd).usd;
  if (!(net > 0)) return 0;
  return cents(net);
}

type SigRow = { err?: unknown; confirmationStatus?: string | null };

async function readStatus(url: string, signature: string): Promise<SigRow | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignatureStatuses",
      params: [[signature], { searchTransactionHistory: true }],
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const body = (await res.json()) as {
    result?: { value?: Array<SigRow | null> };
    error?: { message?: string };
  };
  if (body.error) throw new Error(body.error.message || "RPC error");
  if (!body.result || !Array.isArray(body.result.value)) throw new Error("RPC returned no signature status");
  return body.result.value[0] ?? null;
}

/**
 * One look at the signature. Confirmed or finalized, and no err, is confirmed.
 * An err is failed. A miss is pending. Throws only when both RPCs fail.
 */
export async function confirmSig(signature: string): Promise<"confirmed" | "failed" | "pending"> {
  const sig = typeof signature === "string" ? signature.trim() : "";
  if (!sig) return "pending";
  let last: Error | null = null;
  for (const url of RPCS) {
    try {
      const row = await readStatus(url, sig);
      if (!row) return "pending";
      if (row.err) return "failed";
      if (row.confirmationStatus === "confirmed" || row.confirmationStatus === "finalized") return "confirmed";
      return "pending";
    } catch (e) {
      last = e instanceof Error ? e : new Error("RPC failed");
    }
  }
  throw last ?? new Error("Both Solana RPCs failed");
}

/** Not called on import. A reviewer can invoke this; the module load does not. */
function _selfCheckMoneyMove(): void {
  const net = netLegs([
    { to: "A", usd: 0.004, memo: "dust" },
    { to: "", usd: 9, memo: "blank" },
    { to: "  ", usd: 4, memo: "space" },
    { to: "B", usd: 1.1, memo: "one" },
    { to: "B", usd: 1.2, memo: "two" },
    { to: "C", usd: 0.004, memo: "gone" },
  ]);
  if (net.length !== 1 || net[0].to !== "B" || net[0].usd !== 2.3 || net[0].memo !== "one") {
    throw new Error("netLegs");
  }
  const small = feeOf(0.5);
  const ten = feeOf(10);
  const large = feeOf(1000);
  if (small.bps !== 25 || small.usd !== 0) throw new Error("fee 0.50");
  if (ten.bps !== 25 || ten.usd !== 0.03) throw new Error("fee 10");
  if (large.bps !== 25 || large.usd !== 1) throw new Error("fee 1000");
  if (feeOf(1).usd !== 0.01) throw new Error("fee floor");
  if (payoutAfterFee(0.5) !== 0.5) throw new Error("payout 0.50");
  if (payoutAfterFee(10) !== 9.97) throw new Error("payout 10");
  if (payoutAfterFee(1000) !== 999) throw new Error("payout 1000");
  if (payoutAfterFee(-4) !== 0) throw new Error("payout floor");
}
