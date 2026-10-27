/** International rails. A missing key is "not connected". No balance is invented. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function key(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export const laneStatus = createServerFn({ method: "GET" }).handler(async () => ({
  blindpay: Boolean(key("BLIND_PAY_API_KEY")),
  stripe: Boolean(key("STRIPE_SECRET_KEY")),
  wise: Boolean(key("WISE_API_TOKEN")),
  airwallex: Boolean(key("AIRWALLEX_API_KEY")),
  esim: Boolean(key("ESIM_ACCESS_CODE")),
  yellow: Boolean(key("YELLOWCARD_API_KEY") && key("YELLOWCARD_SECRET")),
}));

export const fxRates = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,MXN,BRL", {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { ok: false as const, error: `Rates ${res.status}` };
  const body = (await res.json()) as { date?: string; rates?: Record<string, number> };
  return { ok: true as const, date: body.date ?? "", rates: body.rates ?? {} };
});

const DOMAINS = [
  ["Solana", 5, "Ethereum", 0],
  ["Solana", 5, "Base", 6],
  ["Solana", 5, "Arbitrum", 3],
  ["Ethereum", 0, "Solana", 5],
  ["Base", 6, "Solana", 5],
  ["Arbitrum", 3, "Solana", 5],
] as const;

export const cctpFees = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await Promise.all(
    DOMAINS.map(async ([from, src, to, dst]) => {
      const res = await fetch(`https://iris-api.circle.com/v2/burn/USDC/fees/${src}/${dst}`, {
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      if (!res?.ok) return { from, to, fees: [] as { finalityThreshold: number; minimumFee: number }[], error: "Circle did not answer." };
      const fees = (await res.json()) as { finalityThreshold: number; minimumFee: number }[];
      return { from, to, fees: Array.isArray(fees) ? fees : [], error: "" };
    }),
  );
  return rows;
});

export const cctpAttest = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ domain: z.number().int().min(0).max(31), tx: z.string().min(32).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://iris-api.circle.com/v2/messages/${data.domain}?transactionHash=${encodeURIComponent(data.tx.trim())}`,
      { signal: AbortSignal.timeout(8000) },
    );
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text.slice(0, 800) };
  });

export const blindQuote = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        usd: z.number().positive().max(50_000),
        bankAccountId: z.string().min(4).max(80),
        network: z.enum(["solana"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const token = key("BLIND_PAY_API_KEY");
    if (!token) return { ok: false as const, error: "BLIND_PAY_API_KEY is not set." };
    const res = await fetch("https://api.blindpay.com/v1/quotes", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        bank_account_id: data.bankAccountId,
        currency_type: "sender",
        cover_fees: false,
        request_amount: Math.round(data.usd * 100),
        network: data.network,
        token: "USDC",
      }),
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text.slice(0, 1200) };
  });

export const issuingCards = createServerFn({ method: "GET" }).handler(async () => {
  const token = key("STRIPE_SECRET_KEY");
  if (!token) return { ok: false as const, error: "STRIPE_SECRET_KEY is not set." };
  const res = await fetch("https://api.stripe.com/v1/issuing/cards?limit=5", {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, error: text.slice(0, 400) };
  let count = 0;
  const last4: string[] = [];
  try {
    const body = JSON.parse(text) as { data?: { last4?: string }[] };
    count = body.data?.length ?? 0;
    for (const card of body.data ?? []) if (card.last4) last4.push(card.last4);
  } catch {
    return { ok: false as const, error: "Stripe did not return cards." };
  }
  return { ok: true as const, count, last4 };
});

export const wiseStatus = createServerFn({ method: "GET" }).handler(async () => {
  const token = key("WISE_API_TOKEN");
  if (!token) return { ok: false as const, error: "WISE_API_TOKEN is not set." };
  const res = await fetch("https://api.wise.com/v1/profiles", {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  return { ok: res.ok, status: res.status };
});

export const TRAVEL = [
  { code: "MX", name: "Mexico" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "ES", name: "Spain" },
  { code: "FR", name: "France" },
  { code: "BR", name: "Brazil" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "PH", name: "Philippines" },
  { code: "AE", name: "UAE" },
] as const;

export type EsimPlan = { code: string; name: string; days: number; gb: number; usd: number };

function plansOf(text: string): EsimPlan[] {
  let body: { obj?: { packageList?: unknown[] } } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return [];
  }
  const list = body.obj?.packageList;
  if (!Array.isArray(list)) return [];
  const out: EsimPlan[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const code = typeof row.packageCode === "string" ? row.packageCode : "";
    if (!code) continue;
    const volume = Number(row.volume) || 0;
    const price = Number(row.price) || 0;
    out.push({
      code,
      name: typeof row.name === "string" ? row.name : code,
      days: Number(row.duration) || 0,
      gb: Math.round((volume / 1_073_741_824) * 10) / 10,
      usd: Math.round(price) / 10_000,
    });
  }
  return out.slice(0, 8);
}

export const esimPlans = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ location: z.string().min(2).max(8) }).parse(input))
  .handler(async ({ data }) => {
    const code = key("ESIM_ACCESS_CODE");
    if (!code) return { ok: false as const, error: "ESIM_ACCESS_CODE is not set.", plans: [] as EsimPlan[] };
    const res = await fetch("https://api.esimaccess.com/api/v1/open/package/list", {
      method: "POST",
      headers: { "content-type": "application/json", "RT-AccessCode": code },
      body: JSON.stringify({ locationCode: data.location.toUpperCase(), type: "", packageCode: "", slug: "", iccid: "" }),
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false as const, error: `ESIMaccess ${res.status}`, plans: [] as EsimPlan[] };
    let err = "";
    try {
      const body = JSON.parse(text) as { success?: boolean; errorMsg?: string };
      if (body.success === false) err = body.errorMsg || "ESIMaccess refused the list.";
    } catch {
      err = "ESIMaccess did not return plans.";
    }
    const plans = plansOf(text);
    if (err) return { ok: false as const, error: err, plans };
    return { ok: true as const, plans };
  });

export const yellowRates = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = key("YELLOWCARD_API_KEY");
  const secret = key("YELLOWCARD_SECRET");
  if (!apiKey || !secret) return { ok: false as const, error: "YELLOWCARD_API_KEY and YELLOWCARD_SECRET are not set." };
  const path = "/business/rates";
  const timestamp = new Date().toISOString();
  const { createHmac } = await import("node:crypto");
  const sig = createHmac("sha256", secret).update(timestamp + path + "GET").digest("base64");
  const res = await fetch(`https://api.yellowcard.io${path}`, {
    headers: { Authorization: `YcHmacSignature ${apiKey}:${sig}`, "X-YC-Timestamp": timestamp },
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text.slice(0, 800) };
});

export const CORRIDORS = [
  { id: "pix", name: "Pix", where: "Brazil", sample: "about 2 min", note: "Sample from an Oct 2026 payout report. Not a live quote. BlindPay can route it when the key is set." },
  { id: "spei", name: "SPEI", where: "Mexico", sample: "about 3 min", note: "Sample from that same report. Completion was cited near 98%. Not a live quote." },
  { id: "mpesa", name: "M-Pesa", where: "Kenya and neighbors", sample: "minutes, when the rail is up", note: "Yellow Card is the specialist. No rate until that key answers." },
  { id: "gcash", name: "GCash", where: "Philippines", sample: "minutes, when a payout partner is connected", note: "Named in the research. No Thunes or Nium key is wired, so this does not pay." },
  { id: "cash", name: "Cash pickup", where: "Where banking is thin", sample: "agent hours, not minutes", note: "Yellow Card claims a cash-agent network. This desk does not invent an agent." },
] as const;
