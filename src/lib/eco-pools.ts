/** Solana markets that have a pool. No ticker is special. */

export type EcoMint = {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  liquidity: number;
  mcap: number;
  decimals: number;
  icon: string;
};

const SOL = "So11111111111111111111111111111111111111112";
const CASH = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
]);
const QUOTE = new Set([SOL, ...CASH]);
const FLOOR = 1_000;

let cache: { at: number; rows: EcoMint[] } | null = null;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Senda" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function put(map: Map<string, EcoMint>, row: EcoMint | null) {
  if (!row || row.mint.length < 32 || QUOTE.has(row.mint) || !(row.price > 0) || row.liquidity < FLOOR) return;
  const prev = map.get(row.mint);
  if (!prev || row.liquidity > prev.liquidity) map.set(row.mint, row);
}

function fromRay(row: Record<string, unknown>, solUsd: number): EcoMint | null {
  const a = row.mintA as { address?: string; symbol?: string; name?: string; decimals?: number; logoURI?: string } | undefined;
  const b = row.mintB as { address?: string; symbol?: string; name?: string; decimals?: number; logoURI?: string } | undefined;
  if (!a?.address || !b?.address) return null;
  const tvl = Number(row.tvl) || 0;
  const px = Number(row.price) || 0;
  if (!(tvl >= FLOOR) || !(px > 0)) return null;
  const aQuote = QUOTE.has(a.address);
  const bQuote = QUOTE.has(b.address);
  if (aQuote === bQuote) return null;
  const asset = aQuote ? b : a;
  const quote = aQuote ? a : b;
  const inQuote = aQuote ? 1 / px : px;
  const usd = CASH.has(quote.address || "") ? inQuote : quote.address === SOL ? inQuote * solUsd : 0;
  if (!(usd > 0) || !asset.address || !asset.symbol) return null;
  return {
    mint: asset.address,
    symbol: asset.symbol,
    name: asset.name || asset.symbol,
    price: usd,
    change: 0,
    liquidity: tvl,
    mcap: 0,
    decimals: Number.isFinite(Number(asset.decimals)) ? Number(asset.decimals) : 6,
    icon: asset.logoURI || "",
  };
}

function fromJup(raw: unknown): EcoMint | null {
  const row = raw as {
    id?: string;
    symbol?: string;
    name?: string;
    icon?: string;
    decimals?: number;
    usdPrice?: number;
    liquidity?: number;
    mcap?: number;
    stats24h?: { priceChange?: number };
  };
  if (!row.id || !row.symbol) return null;
  return {
    mint: row.id,
    symbol: row.symbol,
    name: row.name || row.symbol,
    price: Number(row.usdPrice) || 0,
    change: Number(row.stats24h?.priceChange) || 0,
    liquidity: Number(row.liquidity) || 0,
    mcap: Number(row.mcap) || 0,
    decimals: Number.isFinite(Number(row.decimals)) ? Number(row.decimals) : 6,
    icon: row.icon || "",
  };
}

export async function loadEco(): Promise<EcoMint[]> {
  if (cache && Date.now() - cache.at < 120_000) return cache.rows;
  const map = new Map<string, EcoMint>();
  let solUsd = 0;
  try {
    const px = (await getJson(`https://lite-api.jup.ag/price/v3?ids=${SOL}`)) as Record<string, { usdPrice?: number }>;
    solUsd = Number(px?.[SOL]?.usdPrice) || 0;
  } catch {
    solUsd = 0;
  }

  for (let start = 1; start <= 30; start += 5) {
    const pages = await Promise.all(
      [0, 1, 2, 3, 4].map((n) =>
        getJson(
          `https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=liquidity&sortType=desc&pageSize=100&page=${start + n}`,
        ).catch(() => null),
      ),
    );
    let stop = false;
    for (const body of pages) {
      const data = (body as { data?: { data?: Record<string, unknown>[]; hasNextPage?: boolean } } | null)?.data;
      const rows = data?.data ?? [];
      if (!rows.length) {
        stop = true;
        continue;
      }
      let minTvl = Infinity;
      for (const row of rows) {
        const tvl = Number(row.tvl) || 0;
        if (tvl < minTvl) minTvl = tvl;
        put(map, fromRay(row, solUsd));
      }
      if (minTvl < FLOOR || data?.hasNextPage === false) stop = true;
    }
    if (stop) break;
  }

  const geckoUrls = [
    "https://api.geckoterminal.com/api/v2/networks/solana/trending_pools",
    "https://api.geckoterminal.com/api/v2/networks/solana/new_pools",
    ...[1, 2, 3, 4, 5].map((page) => `https://api.geckoterminal.com/api/v2/networks/solana/pools?page=${page}`),
  ];
  const gecko = await Promise.all(geckoUrls.map((url) => getJson(url).catch(() => null)));
  const need: string[] = [];
  for (const body of gecko) {
    const rows = (body as { data?: { attributes?: Record<string, unknown>; relationships?: { base_token?: { data?: { id?: string } } } }[] } | null)?.data ?? [];
    for (const pool of rows) {
      const id = pool.relationships?.base_token?.data?.id || "";
      const mint = id.startsWith("solana_") ? id.slice("solana_".length) : "";
      if (mint.length < 32 || map.has(mint) || QUOTE.has(mint)) continue;
      const liq = Number(pool.attributes?.reserve_in_usd) || 0;
      if (liq < FLOOR) continue;
      need.push(mint);
    }
  }

  const jupUrls = [
    "https://lite-api.jup.ag/tokens/v2/recent",
    ...["toptraded", "toptrending", "toporganicscore"].flatMap((cat) =>
      ["5m", "1h", "6h", "24h"].map((iv) => `https://lite-api.jup.ag/tokens/v2/${cat}/${iv}?limit=100`),
    ),
  ];
  const lists = await Promise.all(jupUrls.map((url) => getJson(url).catch(() => null)));
  for (const body of lists) {
    if (!Array.isArray(body)) continue;
    for (const raw of body) put(map, fromJup(raw));
  }

  const fresh = [...new Set(need)].filter((mint) => !map.has(mint)).slice(0, 300);
  for (let i = 0; i < fresh.length; i += 100) {
    const q = fresh.slice(i, i + 100).join(",");
    const body = await getJson(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`).catch(() => null);
    if (!Array.isArray(body)) continue;
    for (const raw of body) put(map, fromJup(raw));
  }

  const rows = [...map.values()].sort((a, b) => b.liquidity - a.liquidity || b.mcap - a.mcap);
  cache = { at: Date.now(), rows };
  return rows;
}
