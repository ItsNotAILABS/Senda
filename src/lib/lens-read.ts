/** Public pool print and the largest token accounts for one mint. No holder tape, no dev stats. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";

const RPC = "https://api.mainnet-beta.solana.com";
const SOL = "So11111111111111111111111111111111111111112";

export type LensPool = {
  dex: string;
  price: number;
  liq: number;
  vol: number;
  fdv: number;
  changePct: number | null;
  created: number;
  url: string;
};

export type LensAccount = {
  account: string;
  owner: string;
  ui: number;
  share: number | null;
};

export type LensRead = {
  mint: string;
  symbol: string;
  name: string;
  icon: string;
  jupPrice: number;
  jupChangePct: number | null;
  holders: number | null;
  liquidity: number;
  mcap: number;
  dev: string;
  devMints: number | null;
  devBalPct: number | null;
  topHoldersPct: number | null;
  supply: number | null;
  pools: LensPool[];
  accounts: LensAccount[];
  poolNote: string;
  accountNote: string;
};

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(4_000),
  });
  const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message || "The chain refused that read.");
  return j.result;
}

type Pair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
};

async function poolsOf(mint: string): Promise<{ pools: LensPool[]; symbol: string; name: string; icon: string; note: string }> {
  const r = await cachedJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, 60_000, {
    headers: { accept: "application/json", "user-agent": "Senda" },
  });
  if (!r.ok) return { pools: [], symbol: "", name: "", icon: "", note: "Dexscreener did not answer." };
  const pairs = ((r.body as { pairs?: Pair[] }).pairs || []).filter((pair) => pair.chainId === "solana");
  if (pairs.length === 0) return { pools: [], symbol: "", name: "", icon: "", note: "No Solana pool came back for this mint." };
  const ranked = [...pairs].sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0));
  const best = ranked[0];
  const token = best.baseToken?.address === mint ? best.baseToken : best.quoteToken?.address === mint ? best.quoteToken : best.baseToken;
  const pools = ranked.slice(0, 6).map((pair) => {
    const chg = pair.priceChange?.h24;
    return {
      dex: pair.dexId || "pool",
      price: Number(pair.priceUsd) || 0,
      liq: Number(pair.liquidity?.usd) || 0,
      vol: Number(pair.volume?.h24) || 0,
      fdv: Number(pair.fdv) || 0,
      changePct: typeof chg === "number" && Number.isFinite(chg) ? chg : null,
      created: Number(pair.pairCreatedAt) || 0,
      url: pair.url || "",
    };
  });
  return {
    pools,
    symbol: token?.symbol || "",
    name: token?.name || "",
    icon: best.info?.imageUrl || "",
    note: "",
  };
}

async function jupOf(mint: string): Promise<{
  price: number;
  changePct: number | null;
  symbol: string;
  name: string;
  icon: string;
  holders: number | null;
  liquidity: number;
  mcap: number;
  dev: string;
  devMints: number | null;
  devBalPct: number | null;
  topHoldersPct: number | null;
}> {
  const empty = {
    price: 0,
    changePct: null as number | null,
    symbol: "",
    name: "",
    icon: "",
    holders: null as number | null,
    liquidity: 0,
    mcap: 0,
    dev: "",
    devMints: null as number | null,
    devBalPct: null as number | null,
    topHoldersPct: null as number | null,
  };
  const r = await cachedJson(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, 60_000, {
    headers: { accept: "application/json", "user-agent": "Senda" },
  });
  if (!r.ok || !Array.isArray(r.body)) return empty;
  const rows = r.body as Array<{
    id?: string;
    symbol?: string;
    name?: string;
    icon?: string;
    usdPrice?: number;
    holderCount?: number;
    liquidity?: number;
    mcap?: number;
    dev?: string;
    stats24h?: { priceChange?: number };
    audit?: { topHoldersPercentage?: number; devBalancePercentage?: number; devMints?: number };
  }>;
  const row = rows.find((item) => item.id === mint) ?? rows[0];
  if (!row) return empty;
  const chg = row.stats24h?.priceChange;
  const holders = Number(row.holderCount);
  return {
    price: Number(row.usdPrice) || 0,
    changePct: typeof chg === "number" && Number.isFinite(chg) ? chg : null,
    symbol: row.symbol || "",
    name: row.name || "",
    icon: row.icon || "",
    holders: holders > 0 ? holders : null,
    liquidity: Number(row.liquidity) || 0,
    mcap: Number(row.mcap) || 0,
    dev: typeof row.dev === "string" ? row.dev : "",
    devMints: typeof row.audit?.devMints === "number" ? row.audit.devMints : null,
    devBalPct: typeof row.audit?.devBalancePercentage === "number" ? row.audit.devBalancePercentage : null,
    topHoldersPct: typeof row.audit?.topHoldersPercentage === "number" ? row.audit.topHoldersPercentage : null,
  };
}

async function accountsOf(mint: string): Promise<{ accounts: LensAccount[]; supply: number | null; note: string }> {
  if (mint === SOL) {
    return { accounts: [], supply: null, note: "Native SOL is not a token-account list. Wrapped SOL is a different mint." };
  }
  const supplyRaw = await rpc("getTokenSupply", [mint]).catch(() => null);
  const supply = Number((supplyRaw as { value?: { uiAmount?: number } } | null)?.value?.uiAmount);
  const supplyUi = supply > 0 ? supply : null;
  let largestRaw: unknown = null;
  try {
    largestRaw = await rpc("getTokenLargestAccounts", [mint]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Largest accounts did not come back.";
    return { accounts: [], supply: supplyUi, note: msg };
  }
  const rows = ((largestRaw as { value?: Array<{ address?: string; uiAmount?: number }> } | null)?.value || []).slice(0, 10);
  const keys = rows.map((row) => row.address || "").filter((key) => key.length >= 32);
  let owners = new Map<string, string>();
  if (keys.length) {
    try {
      const many = (await rpc("getMultipleAccounts", [keys, { encoding: "jsonParsed" }])) as {
        value?: Array<{ data?: { parsed?: { info?: { owner?: string } } } } | null>;
      } | null;
      owners = new Map(keys.map((key, i) => [key, many?.value?.[i]?.data?.parsed?.info?.owner || ""]));
    } catch {
      owners = new Map();
    }
  }
  const accounts = rows
    .filter((row) => row.address && Number(row.uiAmount) > 0)
    .map((row) => {
      const ui = Number(row.uiAmount) || 0;
      return {
        account: row.address || "",
        owner: owners.get(row.address || "") || "",
        ui,
        share: supplyUi ? ui / supplyUi : null,
      };
    });
  return {
    accounts,
    supply: supplyUi,
    note: accounts.length ? "" : "The chain returned no large token accounts.",
  };
}

export const readLens = createServerFn({ method: "POST" })
  .validator(z.object({ mint: z.string().min(32).max(48) }))
  .handler(async ({ data }): Promise<LensRead> => {
    const mint = data.mint.trim();
    const [pools, jup, held] = await Promise.all([
      poolsOf(mint).catch((e: unknown) => ({
        pools: [] as LensPool[],
        symbol: "",
        name: "",
        icon: "",
        note: e instanceof Error ? e.message : "Dexscreener did not answer.",
      })),
      jupOf(mint).catch(() => ({
        price: 0,
        changePct: null as number | null,
        symbol: "",
        name: "",
        icon: "",
        holders: null as number | null,
        liquidity: 0,
        mcap: 0,
        dev: "",
        devMints: null as number | null,
        devBalPct: null as number | null,
        topHoldersPct: null as number | null,
      })),
      accountsOf(mint).catch((e: unknown) => ({
        accounts: [] as LensAccount[],
        supply: null as number | null,
        note: e instanceof Error ? e.message : "Largest accounts did not come back.",
      })),
    ]);
    return {
      mint,
      symbol: jup.symbol || pools.symbol,
      name: jup.name || pools.name,
      icon: jup.icon || pools.icon,
      jupPrice: jup.price,
      jupChangePct: jup.changePct,
      holders: jup.holders,
      liquidity: jup.liquidity,
      mcap: jup.mcap,
      dev: jup.dev,
      devMints: jup.devMints,
      devBalPct: jup.devBalPct,
      topHoldersPct: jup.topHoldersPct,
      supply: held.supply,
      pools: pools.pools,
      accounts: held.accounts,
      poolNote: pools.note,
      accountNote: held.note,
    };
  });
