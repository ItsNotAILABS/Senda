/** The perp book Phantom routes. Hyperliquid clears it. Senda does not. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const INFO = "https://api.hyperliquid.xyz/info";

export type HlKind = "crypto" | "stock" | "fx" | "commodity" | "index";

export type HlMarket = {
  id: string;
  label: string;
  asset: number;
  dex: string;
  kind: HlKind;
  maxLeverage: number;
  szDecimals: number;
  mark: number;
  prev: number;
  change: number | null;
  funding: number | null;
  oi: number | null;
  volume: number | null;
};

export type HlPosition = {
  coin: string;
  dex: string;
  size: number;
  side: "long" | "short";
  entry: number;
  liq: number | null;
  pnl: number;
  leverage: number;
  value: number;
};

const FX = new Set(["EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "DXY", "NZD", "KRW", "CNH", "MXN", "BRL"]);
const COMMODITY = new Set(["GOLD", "SILVER", "COPPER", "CL", "BRENTOIL", "NATGAS", "CORN", "WHEAT", "ALUMINIUM", "HO", "PLATINUM", "PALLADIUM", "COCOA", "COFFEE", "SUGAR", "COTTON", "SOY", "WTI"]);
const INDEX = new Set(["XYZ100", "SPX", "SP500", "NDX", "NAS100", "DJI", "VIX", "HSI", "NKY", "DAX", "UK100"]);

function kindOf(label: string, dex: string): HlKind {
  const name = label.toUpperCase();
  if (INDEX.has(name)) return "index";
  if (COMMODITY.has(name)) return "commodity";
  if (FX.has(name)) return "fx";
  if (!dex) return "crypto";
  return "stock";
}

async function info(body: unknown): Promise<unknown> {
  const res = await fetch(INFO, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Hyperliquid ${res.status}`);
  return res.json();
}

type Universe = { name?: string; maxLeverage?: number; szDecimals?: number };
type Ctx = { markPx?: string; prevDayPx?: string; funding?: string; openInterest?: string; dayNtlVlm?: string };

export async function loadHlMarkets(): Promise<HlMarket[]> {
  const dexes = (await info({ type: "perpDexs" })) as Array<{ name?: string } | null>;
  const books = await Promise.all(
    dexes.map(async (dex, dexIndex) => {
      const name = dex?.name || "";
      try {
        const raw = (await info(name ? { type: "metaAndAssetCtxs", dex: name } : { type: "metaAndAssetCtxs" })) as [
          { universe?: Universe[] },
          Ctx[],
        ];
        const universe = raw[0]?.universe ?? [];
        const ctx = raw[1] ?? [];
        return universe.map((row, i) => {
          const full = String(row.name || "");
          const label = full.includes(":") ? full.split(":").slice(1).join(":") : full;
          const mark = Number(ctx[i]?.markPx);
          const prev = Number(ctx[i]?.prevDayPx);
          const funding = Number(ctx[i]?.funding);
          const oi = Number(ctx[i]?.openInterest);
          const volume = Number(ctx[i]?.dayNtlVlm);
          return {
            id: full || `${name}:${i}`,
            label,
            asset: dexIndex === 0 ? i : 100000 + dexIndex * 10000 + i,
            dex: name,
            kind: kindOf(label, name),
            maxLeverage: Number(row.maxLeverage) || 1,
            szDecimals: Number(row.szDecimals) || 0,
            mark: mark > 0 ? mark : 0,
            prev: prev > 0 ? prev : 0,
            change: mark > 0 && prev > 0 ? ((mark - prev) / prev) * 100 : null,
            funding: Number.isFinite(funding) ? funding : null,
            oi: Number.isFinite(oi) ? oi : null,
            volume: Number.isFinite(volume) ? volume : null,
          } satisfies HlMarket;
        });
      } catch {
        return [] as HlMarket[];
      }
    }),
  );
  return books.flat().filter((row) => row.mark > 0);
}

export const hlBook = createServerFn({ method: "GET" }).handler(async () => loadHlMarkets());

export type HlCash = { perp: number; spot: number; abstraction: string };

export const hlCash = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ user: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).parse(input))
  .handler(async ({ data }): Promise<HlCash> => {
    const [perp, spot, mode] = await Promise.all([
      info({ type: "clearinghouseState", user: data.user }) as Promise<{ withdrawable?: string }>,
      info({ type: "spotClearinghouseState", user: data.user }) as Promise<{ balances?: Array<{ coin?: string; total?: string; hold?: string }> }>,
      info({ type: "userAbstraction", user: data.user }).catch(() => "default"),
    ]);
    const usdc = (spot.balances ?? []).find((row) => row.coin === "USDC");
    const free = Math.max(0, Number(usdc?.total || 0) - Number(usdc?.hold || 0));
    return {
      perp: Number(perp.withdrawable) || 0,
      spot: Number.isFinite(free) ? free : 0,
      abstraction: typeof mode === "string" ? mode : "default",
    };
  });

export const hlPositions = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ user: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).parse(input))
  .handler(async ({ data }): Promise<HlPosition[]> => {
    const dexes = (await info({ type: "perpDexs" })) as Array<{ name?: string } | null>;
    const books = await Promise.all(
      dexes.map(async (dex) => {
        const name = dex?.name || "";
        try {
          const state = (await info(
            name ? { type: "clearinghouseState", user: data.user, dex: name } : { type: "clearinghouseState", user: data.user },
          )) as {
            assetPositions?: Array<{
              position?: {
                coin?: string;
                szi?: string;
                entryPx?: string;
                liquidationPx?: string | null;
                unrealizedPnl?: string;
                positionValue?: string;
                leverage?: { value?: number };
              };
            }>;
          };
          return (state.assetPositions ?? []).flatMap((row) => {
            const p = row.position;
            const size = Number(p?.szi);
            if (!p?.coin || !size) return [];
            return [{
              coin: p.coin,
              dex: name,
              size: Math.abs(size),
              side: size > 0 ? "long" as const : "short" as const,
              entry: Number(p.entryPx) || 0,
              liq: p.liquidationPx ? Number(p.liquidationPx) : null,
              pnl: Number(p.unrealizedPnl) || 0,
              leverage: Number(p.leverage?.value) || 0,
              value: Number(p.positionValue) || 0,
            }];
          });
        } catch {
          return [] as HlPosition[];
        }
      }),
    );
    return books.flat();
  });
