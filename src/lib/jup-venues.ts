/** Live Jupiter venues. Reads and unsigned transactions. The wallet signs. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";

const PERPS = "https://perps-api.jup.ag/v1";
const PRED = "https://api.jup.ag/prediction/v1";
const PERPS_HEAD = { accept: "application/json", "x-perps-api-version": "v2" };
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const PERP_ASSETS = [
  { asset: "SOL", mint: "So11111111111111111111111111111111111111112" },
  { asset: "ETH", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs" },
  { asset: "BTC", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh" },
] as const;

export type PerpBoardRow = {
  asset: string;
  mint: string;
  price: number;
  change24h: number;
  volume: number;
  longBorrow: number;
  shortBorrow: number;
  openFee: number;
};

export type PredMarket = {
  marketId: string;
  title: string;
  yesCents: number | null;
  noCents: number | null;
  status: string;
  image: string;
  color: string;
  abbr: string;
};

export type PredEvent = {
  eventId: string;
  title: string;
  category: string;
  league: string;
  live: boolean;
  score: string;
  period: string;
  volumeUsd: number;
  closeTime: number | null;
  markets: PredMarket[];
};

export type PredPosition = {
  id: string;
  title: string;
  side: string;
  size: string;
  claimable: boolean;
};

export type PerpPosition = {
  positionPubkey: string;
  asset: string;
  side: string;
  leverage: string;
  sizeUsd: number;
  collateralUsd: number;
};

function cents(micro: unknown): number | null {
  const n = Number(micro);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n / 10_000) / 100;
}

function usd6(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n / 1_000_000;
}

async function readJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: unknown }> {
  const method = init?.method || "GET";
  if (method === "GET") return cachedJson(url, 15_000, init);
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

function errText(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const o = body as { message?: string; error?: string; code?: string };
    if (o.message) return o.message;
    if (typeof o.error === "string") return o.error;
    if (o.code) return o.code;
  }
  return `Jupiter ${status}`;
}

export const loadPerpBoard = createServerFn({ method: "GET" }).handler(async (): Promise<PerpBoardRow[]> => {
  const rows = await Promise.all(
    PERP_ASSETS.map(async (a) => {
      const [stats, pool] = await Promise.all([
        readJson(`${PERPS}/market-stats?mint=${a.mint}`, { headers: PERPS_HEAD }),
        readJson(`${PERPS}/pool-info?mint=${a.mint}`, { headers: PERPS_HEAD }),
      ]);
      const s = (stats.body || {}) as { price?: string; priceChange24H?: string; volume?: string };
      const p = (pool.body || {}) as { longBorrowRatePercent?: string; shortBorrowRatePercent?: string; openFeePercent?: string };
      return {
        asset: a.asset,
        mint: a.mint,
        price: Number(s.price) || 0,
        change24h: Number(s.priceChange24H) || 0,
        volume: Number(s.volume) || 0,
        longBorrow: Number(p.longBorrowRatePercent) || 0,
        shortBorrow: Number(p.shortBorrowRatePercent) || 0,
        openFee: Number(p.openFeePercent) || 0,
      };
    }),
  );
  return rows.filter((r) => r.price > 0);
});

export const loadPerpPositions = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ owner: z.string().min(32).max(48) }).parse(input))
  .handler(async ({ data }): Promise<PerpPosition[]> => {
    const res = await readJson(`${PERPS}/positions?walletAddress=${data.owner}`, { headers: PERPS_HEAD });
    if (!res.ok) return [];
    const list = ((res.body as { dataList?: unknown[] })?.dataList || []) as Array<Record<string, string>>;
    return list.map((row) => ({
      positionPubkey: String(row.positionPubkey || ""),
      asset: String(row.asset || ""),
      side: String(row.side || ""),
      leverage: String(row.leverage || ""),
      sizeUsd: usd6(row.sizeUsd),
      collateralUsd: usd6(row.collateralUsd),
    })).filter((r) => r.positionPubkey);
  });

const orderInput = z.object({
  owner: z.string().min(32).max(48),
  asset: z.enum(["SOL", "ETH", "BTC"]),
  side: z.enum(["long", "short"]),
  usd: z.number().min(1).max(50_000),
  leverage: z.number().min(1.1).max(20),
});

export const buildPerpIncrease = createServerFn({ method: "POST" })
  .validator((input: unknown) => orderInput.parse(input))
  .handler(async ({ data }) => {
    const res = await readJson(`${PERPS}/positions/increase`, {
      method: "POST",
      headers: { ...PERPS_HEAD, "content-type": "application/json" },
      body: JSON.stringify({
        asset: data.asset,
        inputToken: "USDC",
        inputTokenAmount: String(Math.round(data.usd * 1_000_000)),
        leverage: data.leverage.toFixed(1),
        maxSlippageBps: "100",
        side: data.side,
        walletAddress: data.owner,
      }),
    });
    if (!res.ok) throw new Error(errText(res.body, res.status));
    const body = res.body as { serializedTxBase64?: string; quote?: Record<string, unknown> };
    if (!body.serializedTxBase64) throw new Error("Jupiter did not return a transaction.");
    return { tx: body.serializedTxBase64 };
  });

export const buildPerpDecrease = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ positionPubkey: z.string().min(32) }).parse(input))
  .handler(async ({ data }) => {
    const res = await readJson(`${PERPS}/positions/decrease`, {
      method: "POST",
      headers: { ...PERPS_HEAD, "content-type": "application/json" },
      body: JSON.stringify({
        positionPubkey: data.positionPubkey,
        entirePosition: true,
        receiveToken: "USDC",
        maxSlippageBps: "100",
      }),
    });
    if (!res.ok) throw new Error(errText(res.body, res.status));
    const body = res.body as { serializedTxBase64?: string };
    if (!body.serializedTxBase64) throw new Error("Jupiter did not return a close transaction.");
    return { tx: body.serializedTxBase64 };
  });

export const executePerpTx = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      action: z.enum(["increase-position", "decrease-position"]),
      serializedTxBase64: z.string().min(20),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await readJson(`${PERPS}/transaction/execute`, {
      method: "POST",
      headers: { ...PERPS_HEAD, "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(errText(res.body, res.status));
    const body = res.body as { txid?: string };
    if (!body.txid) throw new Error("Jupiter took the signature and did not return a transaction id.");
    return { txid: body.txid };
  });

export const loadPredEvents = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ category: z.enum(["crypto", "sports", "politics"]) }).parse(input))
  .handler(async ({ data }): Promise<PredEvent[]> => {
    const qs = new URLSearchParams({
      category: data.category,
      filter: data.category === "politics" ? "trending" : "live",
      includeMarkets: "true",
      start: "0",
      end: "16",
    });
    const res = await readJson(`${PRED}/events?${qs}`);
    if (!res.ok) throw new Error(errText(res.body, res.status));
    const list = ((res.body as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
    const built = list.map((ev) => {
      const meta = (ev.metadata || {}) as { title?: string; league?: string };
      const grouped = ((ev.sportsMarketGroups as Array<Record<string, unknown>>) || []).flatMap((g) =>
        ((g.marketTypes as Array<Record<string, unknown>>) || []).flatMap((t) => (t.markets as Array<Record<string, unknown>>) || []),
      );
      const rawMarkets = [...((ev.markets as Array<Record<string, unknown>>) || []), ...grouped];
      const seen = new Set<string>();
      const priced = rawMarkets.flatMap((m) => {
        const pricing = (m.pricing || {}) as { buyYesPriceUsd?: number; buyNoPriceUsd?: number };
        const option = ((m.marketOptions as Array<{ label?: string }>) || [])[0];
        const marketId = String(m.marketId || "");
        const yesCents = cents(pricing.buyYesPriceUsd);
        if (!marketId || String(m.status || "") !== "open" || seen.has(marketId)) return [];
        if (yesCents == null || yesCents < 0.02 || yesCents > 0.98) return [];
        seen.add(marketId);
        const team = (m.team || {}) as { imageUrl?: string; color?: string; abbreviation?: string };
        return [{
          marketId,
          title: option?.label || String(m.title || ""),
          yesCents,
          noCents: cents(pricing.buyNoPriceUsd),
          status: "open",
          kind: String(m.sportsMarketType || ""),
          image: String(team.imageUrl || m.imageUrl || ""),
          color: String(team.color || ""),
          abbr: String(team.abbreviation || "").slice(0, 4).toUpperCase(),
        }];
      });
      const moneyline = priced.filter((m) => m.kind === "moneyline");
      const markets = (moneyline.length > 0 ? moneyline : priced).slice(0, 2).map(({ kind: _kind, ...m }) => m);
      const close = Number(rawMarkets[0]?.closeTime || 0);
      return {
        eventId: String(ev.eventId || ""),
        title: meta.title || String(ev.eventId || "Market"),
        category: String(ev.category || data.category),
        league: String(meta.league || ev.subcategory || ""),
        live: Boolean(ev.isLive),
        score: "",
        period: "",
        volumeUsd: usd6(ev.volumeUsd),
        closeTime: close > 0 ? close : null,
        markets,
      };
    }).filter((ev) => ev.markets.length > 0);
    if (data.category !== "sports" || built.length === 0) return built;
    const ids = built.map((e) => e.eventId).join(",");
    const scores = await readJson(`${PRED}/events/scores?eventIds=${encodeURIComponent(ids)}`);
    const rows = ((scores.body as { data?: Array<Record<string, unknown>> })?.data || []);
    const byId = new Map(rows.map((s) => [String(s.eventId || ""), s]));
    return built
      .map((ev) => {
        const s = byId.get(ev.eventId);
        if (!s) return ev;
        return {
          ...ev,
          live: Boolean(s.live) || ev.live,
          score: String(s.score || ""),
          period: String(s.period || ""),
        };
      })
      .sort((a, b) => Number(b.live) - Number(a.live) || b.volumeUsd - a.volumeUsd);
  });

export const loadPredPositions = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ owner: z.string().min(32).max(48) }).parse(input))
  .handler(async ({ data }): Promise<PredPosition[]> => {
    const res = await readJson(`${PRED}/positions?ownerPubkey=${data.owner}`);
    if (!res.ok) return [];
    const list = ((res.body as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
    return list.map((row) => ({
      id: String(row.positionPubkey || row.id || ""),
      title: String(row.marketTitle || row.title || row.marketId || "Position"),
      side: String(row.side || (row.isYes === false ? "NO" : "YES")),
      size: String(row.contracts ?? row.size ?? ""),
      claimable: Boolean(row.claimable),
    })).filter((r) => r.id);
  });

export const buildPredOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      owner: z.string().min(32).max(48),
      marketId: z.string().min(3),
      isYes: z.boolean(),
      usd: z.number().min(1).max(250),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await readJson(`${PRED}/orders`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        ownerPubkey: data.owner,
        marketId: data.marketId,
        isYes: data.isYes,
        isBuy: true,
        depositAmount: String(Math.round(data.usd * 1_000_000)),
        depositMint: USDC_MINT,
      }),
    });
    if (!res.ok) throw new Error(errText(res.body, res.status));
    const body = res.body as { transaction?: string; order?: { orderPubkey?: string } };
    if (!body.transaction) throw new Error("Jupiter did not return a transaction.");
    return { tx: body.transaction, order: body.order?.orderPubkey || "" };
  });
