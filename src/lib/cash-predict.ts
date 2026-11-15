/** Outcome token for a prediction. The swap itself is signed by Phantom. Senda never holds the key. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CASH } from "@/lib/jup-sign";
import type { KalshiRow } from "@/lib/kalshi-book";

const PRED = "https://api.jup.ag/prediction/v1";
const META = "https://prediction-markets-api.dflow.net/api/v1";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function price(microUsd: unknown): number | null {
  const n = Number(microUsd);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round((n / 1e6) * 10000) / 10000;
}

type PredCache = { at: number; rows: KalshiRow[]; seen: Set<string>; next: number; done: boolean };
let pred: PredCache = { at: 0, rows: [], seen: new Set(), next: 0, done: false };
let predWalking: Promise<void> | null = null;

function marketsOf(ev: Record<string, unknown>): Array<Record<string, unknown>> {
  const grouped = ((ev.sportsMarketGroups as Array<Record<string, unknown>>) || []).flatMap((g) =>
    ((g.marketTypes as Array<Record<string, unknown>>) || []).flatMap((t) => (t.markets as Array<Record<string, unknown>>) || []),
  );
  return [...((ev.markets as Array<Record<string, unknown>>) || []), ...grouped];
}

function rowsFrom(events: Array<Record<string, unknown>>): KalshiRow[] {
  const out: KalshiRow[] = [];
  for (const ev of events) {
    const meta = (ev.metadata || {}) as { title?: string; closeTime?: string };
    const title = meta.title?.trim() || "Market";
    const close = String(meta.closeTime || "").slice(0, 10);
    const category = String(ev.category || "Markets");
    const eventId = String(ev.eventId || title);
    const eventVol = Number(ev.volumeUsd || 0) / 1e6 || 0;
    for (const market of marketsOf(ev)) {
      const marketId = String(market.marketId || "");
      if (!marketId || pred.seen.has(marketId)) continue;
      const status = String(market.status || "open");
      if (status !== "open") continue;
      const pricing = (market.pricing || {}) as { buyYesPriceUsd?: number; buyNoPriceUsd?: number; volume?: number };
      const yes = price(pricing.buyYesPriceUsd);
      const no = price(pricing.buyNoPriceUsd);
      if (yes == null && no == null) continue;
      pred.seen.add(marketId);
      const option = ((market.marketOptions as Array<{ label?: string }>) || [])[0];
      const leg = String(option?.label || market.title || "").trim();
      out.push({
        ticker: marketId,
        event: eventId,
        title,
        yes: leg && leg !== title ? leg : "",
        category,
        bid: null,
        ask: yes,
        last: yes,
        noAsk: no,
        vol: Number(pricing.volume || 0) || eventVol,
        close,
      });
    }
  }
  return out;
}

async function pullPred(start: number): Promise<{ rows: KalshiRow[]; next: number; hasNext: boolean }> {
  const end = start + 24;
  const res = await fetch(`${PRED}/events?includeMarkets=true&start=${start}&end=${end}`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error("The prediction book did not answer.");
  const json = (await res.json()) as { data?: Array<Record<string, unknown>>; pagination?: { end?: number; hasNext?: boolean } };
  const data = json.data ?? [];
  return {
    rows: rowsFrom(data),
    next: Number(json.pagination?.end ?? end),
    hasNext: Boolean(json.pagination?.hasNext) && data.length > 0 && pred.rows.length < 6000,
  };
}

function walkPred() {
  if (predWalking) return predWalking;
  predWalking = (async () => {
    for (let i = 0; i < 4 && !pred.done; i += 1) {
      try {
        const page = await pullPred(pred.next);
        pred.rows.push(...page.rows);
        pred.next = page.next;
        pred.done = !page.hasNext;
        pred.at = Date.now();
      } catch {
        pred.at = Date.now();
        break;
      }
    }
  })().finally(() => {
    predWalking = null;
  });
  return predWalking;
}

function ensurePred() {
  if ((!pred.done || pred.rows.length === 0) && !predWalking) void walkPred();
  else if (pred.done && Date.now() - pred.at > 5 * 60_000 && !predWalking) {
    pred = { at: 0, rows: [], seen: new Set(), next: 0, done: false };
    void walkPred();
  }
}

/** Live events Jupiter can build an order for. The phone asks Phantom to sign that order. */
export const predictPage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(80).optional(),
        category: z.string().max(48).optional(),
        offset: z.number().int().min(0).max(250_000).optional(),
        limit: z.number().int().min(1).max(240).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    ensurePred();
    if (pred.rows.length < 40) {
      await Promise.race([walkPred(), new Promise((resolve) => setTimeout(resolve, 8000))]);
    }
    const q = (data.q ?? "").trim().toLowerCase();
    const category = (data.category ?? "").trim();
    let rows = pred.rows;
    if (category) rows = rows.filter((r) => r.category === category);
    if (q) rows = rows.filter((r) => `${r.ticker} ${r.title} ${r.yes} ${r.event}`.toLowerCase().includes(q));
    else rows = rows.slice().sort((a, b) => b.vol - a.vol);
    const offset = data.offset ?? 0;
    const limit = data.limit ?? 60;
    const cats = new Map<string, number>();
    for (const r of pred.rows) cats.set(r.category, (cats.get(r.category) ?? 0) + 1);
    return {
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      loaded: pred.rows.length,
      done: pred.done,
      categories: [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n })),
    };
  });

/** Live events. Kept for callers that still page the public book directly. */
export async function cashEvents(start = 0, end = 24): Promise<{ rows: KalshiRow[]; done: boolean }> {
  const res = await fetch(`${PRED}/events?includeMarkets=true&start=${start}&end=${end}`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error("The prediction book did not answer.");
  const json = (await res.json()) as { data?: Array<Record<string, unknown>>; pagination?: { hasNext?: boolean } };
  const hold = pred;
  pred = { at: 0, rows: [], seen: new Set(), next: 0, done: false };
  const rows = rowsFrom(json.data ?? []);
  pred = hold;
  return { rows, done: !json.pagination?.hasNext };
}

type Minted = { yesMint?: string; noMint?: string };

function pickMint(accounts: Record<string, Minted> | undefined, side: "yes" | "no"): string {
  const acct = accounts?.[CASH] ?? accounts?.[USDC] ?? Object.values(accounts ?? {})[0];
  const mint = side === "yes" ? acct?.yesMint : acct?.noMint;
  return mint && mint.length >= 32 ? mint : "";
}

/** The token this Kalshi contract settles into, when DFlow has listed it. */
export async function outcomeForTicker(eventTicker: string, marketTicker: string, side: "yes" | "no"): Promise<string> {
  const url = `${META}/event/${encodeURIComponent(eventTicker || marketTicker)}?withNestedMarkets=true`;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) throw new Error("No Solana outcome for that Kalshi contract. Phantom was not asked to sign.");
  const json = (await res.json()) as { markets?: Array<{ ticker?: string; accounts?: Record<string, Minted> }>; event?: { markets?: Array<{ ticker?: string; accounts?: Record<string, Minted> }> } };
  const markets = json.markets ?? json.event?.markets ?? [];
  const hit = markets.find((market) => market.ticker === marketTicker) ?? (markets.length === 1 ? markets[0] : undefined);
  const mint = pickMint(hit?.accounts, side);
  if (mint) return mint;
  throw new Error("No Solana outcome for that Kalshi contract. Phantom was not asked to sign.");
}

/** Title search. Prefer outcomeForTicker when the Kalshi ticker is known. */
export async function outcomeFor(query: string, side: "yes" | "no"): Promise<string> {
  const url = `${META}/search?q=${encodeURIComponent(query)}&withNestedMarkets=true&limit=5`;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) throw new Error("No outcome token for that contract. Phantom was not asked to sign.");
  const json = (await res.json()) as { events?: Array<{ markets?: Array<{ accounts?: Record<string, Minted> }> }> };
  for (const event of json.events ?? []) {
    for (const market of event.markets ?? []) {
      const mint = pickMint(market.accounts, side);
      if (mint) return mint;
    }
  }
  throw new Error("No outcome token for that contract. Phantom was not asked to sign.");
}

/** Jupiter builds the prediction order. Phantom signs it. Nothing is filled until that signature lands. */
export async function signPrediction(input: {
  owner: string;
  marketId: string;
  isYes: boolean;
  usd: number;
  mint: string;
}): Promise<{ signature: string }> {
  if (!(input.usd > 0)) throw new Error("Enter an amount.");
  if (!input.marketId) throw new Error("That contract has no market id. Phantom was not asked to sign.");
  const { spendCap } = await import("@/lib/spend-cap");
  const cap = spendCap();
  if (input.usd > cap) throw new Error(`That is about $${input.usd.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.`);
  const res = await fetch(`${PRED}/orders`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      ownerPubkey: input.owner,
      marketId: input.marketId,
      isYes: input.isYes,
      isBuy: true,
      depositAmount: String(Math.round(input.usd * 1e6)),
      depositMint: input.mint,
    }),
    signal: AbortSignal.timeout(12000),
  });
  const json = (await res.json().catch(() => ({}))) as { transaction?: string; message?: string; error?: string };
  if (!res.ok || !json.transaction) {
    const why = json.message || (typeof json.error === "string" ? json.error : "") || `Jupiter ${res.status}`;
    throw new Error(`${why} Phantom was not asked to sign.`);
  }
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const { VersionedTransaction } = await import("@solana/web3.js");
  const { sendVersioned } = await import("@/lib/phantom");
  const tx = VersionedTransaction.deserialize(Buffer.from(json.transaction, "base64"));
  const signature = await sendVersioned(tx);
  return { signature };
}
