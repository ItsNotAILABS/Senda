/** Ostium prints, and the Jupiter tokens that can actually be signed. */

import { createServerFn } from "@tanstack/react-start";

export type WorldLane = "fx" | "metals" | "energy" | "softs" | "index" | "crypto" | "shares";

export type WorldHold = { mint: string; symbol: string; note: string };

export type WorldRow = {
  id: string;
  lane: WorldLane;
  base: string;
  quote: string;
  bid: number | null;
  mid: number | null;
  ask: number | null;
  open: boolean | null;
  hold: WorldHold | null;
  spot: number | null;
  pairIndex: number | null;
  maxLeverage: number | null;
};

export type TapeRow = {
  id: string;
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  icon?: string;
  /** Pool depth in dollars, when Jupiter search returned it. */
  liquidity?: number;
};

const OSTIUM = "https://builder.prod.bedrock.ostium.io/v1/prices";
const JUP = "https://api.jup.ag/price/v3?ids=";
const FEEDS = [
  "https://lite-api.jup.ag/tokens/v2/tag?query=stocks",
  "https://lite-api.jup.ag/tokens/v2/tag?query=verified",
  "https://lite-api.jup.ag/tokens/v2/tag?query=lst",
  "https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=100",
];

const BOOK: { lane: WorldLane; ids: string[] }[] = [
  {
    lane: "fx",
    ids: ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "NZD-USD", "USD-CAD", "USD-CHF", "USD-MXN"],
  },
  { lane: "metals", ids: ["XAU-USD", "XAG-USD", "XPT-USD", "XPD-USD", "XCU-USD", "REMX-USD", "DRAM-USD"] },
  { lane: "energy", ids: ["WTI-USD", "BRENT-USD", "DIESEL-USD", "UNG-USD", "XLE-USD", "URA-USD", "XOM-USD", "CVX-USD", "SHEL-USD"] },
  { lane: "softs", ids: ["COCOA-USD", "COFFEE-USD", "COTTON-USD", "SUGAR-USD"] },
  {
    lane: "index",
    ids: ["US500-USD", "US100-USD", "US30-USD", "GER40-EUR", "UK100-GBP", "JP225-JPY"],
  },
  { lane: "crypto", ids: ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "LINK-USD"] },
  {
    lane: "shares",
    ids: [
      "NVDA-USD", "AAPL-USD", "TSLA-USD", "MSFT-USD", "AMZN-USD", "META-USD", "GOOG-USD",
      "AMD-USD", "AVGO-USD", "NFLX-USD", "COIN-USD", "HOOD-USD", "PLTR-USD", "MSTR-USD",
      "INTC-USD", "ORCL-USD", "LLY-USD", "COST-USD", "TSM-USD", "ASML-USD", "ARM-USD",
      "CAT-USD", "CRCL-USD", "DELL-USD", "MRNA-USD", "MRVL-USD", "MU-USD", "NVO-USD",
      "RIVN-USD", "SMCI-USD", "SPOT-USD",
    ],
  },
];

const HOLDS: Record<string, WorldHold> = {
  "XAU-USD": {
    mint: "5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW",
    symbol: "PAXG",
    note: "One ounce of gold in the wallet. The print is separate.",
  },
  "XAG-USD": {
    mint: "iy11ytbSGcUnrjE6Lfv78TFqxKyUESfku1FugS9ondo",
    symbol: "SLV",
    note: "The silver trust in the wallet. The print is separate.",
  },
  "BTC-USD": {
    mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
    symbol: "WBTC",
    note: "Portal bitcoin on Solana. Not the print.",
  },
  "ETH-USD": {
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    symbol: "ETH",
    note: "Portal ether on Solana. Not the print.",
  },
  "SOL-USD": {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    note: "SOL itself. Not the print.",
  },
  "XRP-USD": {
    mint: "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2",
    symbol: "wXRP",
    note: "Wrapped XRP in the wallet. The print is separate.",
  },
  "LINK-USD": {
    mint: "LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L",
    symbol: "LINK",
    note: "Chainlink in the wallet. The print is separate.",
  },
  "EUR-USD": {
    mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
    symbol: "EURC",
    note: "Circle euro in the wallet. The print is separate.",
  },
  "GBP-USD": {
    mint: "5H4voZhzySsVvwVYDAKku8MZGuYBC7cXaBKDPW4YHWW1",
    symbol: "VGBP",
    note: "VNX pound in the wallet. The print is separate.",
  },
  "USD-CHF": {
    mint: "AhhdRu5YZdjVkKR3wbnUDaymVQL2ucjMQ63sZ3LFHsch",
    symbol: "VCHF",
    note: "VNX franc in the wallet. The print is separate.",
  },
  "USD-MXN": {
    mint: "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa",
    symbol: "MXNe",
    note: "Peso token in the wallet. The book is thin.",
  },
  "US500-USD": {
    mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    symbol: "SPYx",
    note: "S&P xStock in the wallet. The print is separate.",
  },
  "US100-USD": {
    mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
    symbol: "QQQx",
    note: "Nasdaq xStock in the wallet. The print is separate.",
  },
  "XLE-USD": {
    mint: "Xs54CrhmpVp6uxZXwgSTegrRH2kShh88XFPzgf4BExu",
    symbol: "XLEx",
    note: "Energy xStock in the wallet. The print is separate.",
  },
  "XOM-USD": {
    mint: "XsaHND8sHyfMfsWPj6kSdd5VwvCayZvjYgKmmcNL5qh",
    symbol: "XOMx",
    note: "Exxon xStock in the wallet. The print is separate.",
  },
  "CVX-USD": {
    mint: "XsNNMt7WTNA2sV3jrb1NNfNgapxRF5i4i6GcnTRRHts",
    symbol: "CVXx",
    note: "Chevron xStock in the wallet. The print is separate.",
  },
  "NVDA-USD": { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", symbol: "NVDAx", note: "NVIDIA xStock in the wallet. The print is separate." },
  "AAPL-USD": { mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", symbol: "AAPLx", note: "Apple xStock in the wallet. The print is separate." },
  "TSLA-USD": { mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", symbol: "TSLAx", note: "Tesla xStock in the wallet. The print is separate." },
  "MSFT-USD": { mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", symbol: "MSFTx", note: "Microsoft xStock in the wallet. The print is separate." },
  "AMZN-USD": { mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", symbol: "AMZNx", note: "Amazon xStock in the wallet. The print is separate." },
  "META-USD": { mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", symbol: "METAx", note: "Meta xStock in the wallet. The print is separate." },
  "AMD-USD": { mint: "XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF", symbol: "AMDx", note: "AMD xStock in the wallet. The print is separate." },
  "AVGO-USD": { mint: "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo", symbol: "AVGOx", note: "Broadcom xStock in the wallet. The print is separate." },
  "NFLX-USD": { mint: "XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL", symbol: "NFLXx", note: "Netflix xStock in the wallet. The print is separate." },
  "COIN-USD": { mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", symbol: "COINx", note: "Coinbase xStock in the wallet. The print is separate." },
  "HOOD-USD": { mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", symbol: "HOODx", note: "Robinhood xStock in the wallet. The print is separate." },
  "PLTR-USD": { mint: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4", symbol: "PLTRx", note: "Palantir xStock in the wallet. The print is separate." },
  "MSTR-USD": { mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", symbol: "MSTRx", note: "MicroStrategy xStock in the wallet. The print is separate." },
  "INTC-USD": { mint: "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM", symbol: "INTCx", note: "Intel xStock in the wallet. The print is separate." },
  "ORCL-USD": { mint: "XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL", symbol: "ORCLx", note: "Oracle xStock in the wallet. The print is separate." },
  "LLY-USD": { mint: "Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH", symbol: "LLYx", note: "Eli Lilly xStock in the wallet. The print is separate." },
  "COST-USD": { mint: "XsiRaD8qZm1P3KViowDYFS8rZ8BYT2g7ZEeyztthRye", symbol: "COSTx", note: "Costco xStock in the wallet. The print is separate." },
  "TSM-USD": { mint: "XsafvsGtzFqqHgTnA3aPC83EAMkacU5mcGtcSayhpVV", symbol: "TSMx", note: "TSMC xStock in the wallet. The print is separate." },
  "ASML-USD": { mint: "XshuHQ6o6SVpUNawvnnTMxsZ4tacZsNgVCLorv7TkFq", symbol: "ASMLx", note: "ASML xStock in the wallet. The print is separate." },
  "ARM-USD": { mint: "XswUFSYE5CWsZM3X3yo6e2pZvxcAzx912DonGvgUFka", symbol: "ARMx", note: "ARM xStock in the wallet. The print is separate." },
  "CAT-USD": { mint: "XsRvd1meWQ9kW1SrZPa1jokQqmBoPWWjd6wGTgdp5E6", symbol: "CATx", note: "Caterpillar xStock in the wallet. The print is separate." },
  "CRCL-USD": { mint: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", symbol: "CRCLx", note: "Circle xStock in the wallet. The print is separate." },
  "DELL-USD": { mint: "Xsu7Tc5J2fVUE4H5vYAiSr34cvLJeCsYPMjAYnayQn6", symbol: "DELLx", note: "Dell xStock in the wallet. The print is separate." },
  "MRNA-USD": { mint: "XsViHjyRbiSBskjizb1gszGTmZqtAH8TuqwJ7sB5AcP", symbol: "MRNAx", note: "Moderna xStock in the wallet. The print is separate." },
  "MRVL-USD": { mint: "XsuxRGDzbLjnJ72v74b7p9VY6N66uYgTCyfwwRjVCJA", symbol: "MRVLx", note: "Marvell xStock in the wallet. The print is separate." },
  "MU-USD": { mint: "XsQLZycSZ7QnBBdBXQaTbQdiUcbRqjNJgyBGAMzhHav", symbol: "MUx", note: "Micron xStock in the wallet. The print is separate." },
  "NVO-USD": { mint: "XsfAzPzYrYjd4Dpa9BU3cusBsvWfVB9gBcyGC87S57n", symbol: "NVOx", note: "Novo Nordisk xStock in the wallet. The print is separate." },
  "RIVN-USD": { mint: "XsoxDMY8s3ZV7zD4Yd87wAvURyxA8VXkd7w6HNuQkzj", symbol: "RIVNx", note: "Rivian xStock in the wallet. The print is separate." },
  "SMCI-USD": { mint: "XsMxAoJP47FQGLsVUvSS2QfBaHdNsd7DRU6nWRL8RSa", symbol: "SMCIx", note: "Super Micro xStock in the wallet. The print is separate." },
  "SPOT-USD": { mint: "Xss3SfGpiR5nhJYsJ7gdd1qiNGxcsr5NX78rmGBDtND", symbol: "SPOTx", note: "Spotify xStock in the wallet. The print is separate." },
};

export function listedPrints(): { id: string; lane: WorldLane; symbol: string; mint: string; note: string }[] {
  return BOOK.flatMap(({ lane, ids }) =>
    ids.map((id) => {
      const hold = HOLDS[id] ?? null;
      const base = id.split("-")[0] ?? id;
      return {
        id,
        lane,
        symbol: hold?.symbol ?? base,
        mint: hold?.mint ?? "",
        note: hold?.note ?? "Ostium print. No Solana token on this row.",
      };
    }),
  );
}

type OstiumPrice = {
  pair?: string;
  bid?: unknown;
  mid?: unknown;
  ask?: unknown;
  isMarketOpen?: unknown;
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function splitPair(id: string): { base: string; quote: string } {
  const i = id.indexOf("-");
  if (i < 0) return { base: id, quote: "" };
  return { base: id.slice(0, i), quote: id.slice(i + 1) };
}

async function getJson(url: string, ms: number): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "Senda" },
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function ostiumRows(json: unknown): OstiumPrice[] {
  if (Array.isArray(json)) return json as OstiumPrice[];
  if (json && typeof json === "object" && Array.isArray((json as { prices?: unknown }).prices)) {
    return (json as { prices: OstiumPrice[] }).prices;
  }
  return [];
}

async function loadBook(): Promise<WorldRow[]> {
  const byPair = new Map<string, OstiumPrice>();
  try {
    for (const row of ostiumRows(await getJson(OSTIUM, 8000))) {
      if (row?.pair) byPair.set(row.pair, row);
    }
  } catch {
    /* every pair still returns, with null prices */
  }

  const mints = [...new Set(Object.values(HOLDS).map((h) => h.mint))];
  const spot = new Map<string, number | null>();
  for (const mint of mints) spot.set(mint, null);
  try {
    const json = (await getJson(`${JUP}${mints.join(",")}`, 8000)) as Record<
      string,
      { usdPrice?: unknown }
    >;
    for (const mint of mints) spot.set(mint, num(json?.[mint]?.usdPrice));
  } catch {
    /* spots stay null */
  }

  return BOOK.flatMap(({ lane, ids }) =>
    ids.map((id) => rowFrom(id, lane, byPair, spot)),
  );
}

function laneFor(id: string): WorldLane {
  for (const group of BOOK) if (group.ids.includes(id)) return group.lane;
  const base = id.split("-")[0] ?? id;
  if (base === "USD" || ["EUR", "GBP", "AUD", "NZD"].includes(base)) return "fx";
  if (["XAU", "XAG", "XPT", "XPD", "XCU", "REMX", "DRAM"].includes(base)) return "metals";
  if (["WTI", "BRENT", "DIESEL", "UNG", "URA"].includes(base)) return "energy";
  if (["COCOA", "COFFEE", "COTTON", "SUGAR"].includes(base)) return "softs";
  if (["US500", "US100", "US30", "GER40", "UK100", "JP225", "HK50", "KR2550", "HYG", "TLT"].includes(base)) return "index";
  if (["BTC", "ETH", "SOL", "XRP", "ADA", "BNB", "HYPE", "TRX", "LINK"].includes(base)) return "crypto";
  return "shares";
}

function rowFrom(id: string, lane: WorldLane, byPair: Map<string, OstiumPrice>, spot: Map<string, number | null>): WorldRow {
  const hit = byPair.get(id);
  const { base, quote } = splitPair(id);
  const hold = HOLDS[id] ?? null;
  const open = typeof hit?.isMarketOpen === "boolean" ? hit.isMarketOpen : null;
  return {
    id,
    lane,
    base,
    quote,
    bid: hit ? num(hit.bid) : null,
    mid: hit ? num(hit.mid) : null,
    ask: hit ? num(hit.ask) : null,
    open,
    hold,
    spot: hold ? (spot.get(hold.mint) ?? null) : null,
    pairIndex: null,
    maxLeverage: null,
  };
}

const GRAPH = "https://api.subgraph.ormilabs.com/api/public/67a599d5-c8d2-4cc4-9c4d-2975a97bc5d8/subgraphs/ost-prod/live/gn";
const PRICE_ALIAS: Record<string, string> = {
  "SPX-USD": "US500-USD",
  "NDX-USD": "US100-USD",
  "DJI-USD": "US30-USD",
  "NIK-JPY": "JP225-JPY",
  "FTSE-GBP": "UK100-GBP",
  "DAX-EUR": "GER40-EUR",
  "HSI-HKD": "HK50-HKD",
  "HG-USD": "XCU-USD",
  "CL-USD": "WTI-USD",
};

async function contractPairs(): Promise<{ id: number; from: string; to: string; maxLeverage: number }[]> {
  const res = await fetch(GRAPH, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Senda" },
    body: JSON.stringify({ query: "{ pairs(first: 500) { id from to maxLeverage } }" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { pairs?: { id?: string; from?: string; to?: string; maxLeverage?: string }[] } };
  return (json.data?.pairs ?? [])
    .filter((p) => p.from && p.to && p.id != null)
    .map((p) => ({
      id: Number(p.id),
      from: String(p.from),
      to: String(p.to),
      maxLeverage: Number(p.maxLeverage) || 0,
    }));
}

async function loadOstium(): Promise<WorldRow[]> {
  const byPair = new Map<string, OstiumPrice>();
  try {
    for (const row of ostiumRows(await getJson(OSTIUM, 8000))) {
      if (row?.pair) byPair.set(row.pair, row);
    }
  } catch {
    /* prices stay empty */
  }
  const listed = await contractPairs().catch(() => []);
  const feedIds = listed.map((p) => PRICE_ALIAS[`${p.from}-${p.to}`] ?? `${p.from}-${p.to}`);
  const extra = [...byPair.keys()].filter((id) => !feedIds.includes(id));
  const ids = [...feedIds, ...extra];
  const mints = [...new Set(ids.map((id) => HOLDS[id]?.mint).filter((mint): mint is string => Boolean(mint)))];
  const spot = new Map<string, number | null>();
  for (const mint of mints) spot.set(mint, null);
  try {
    if (mints.length) {
      const json = (await getJson(`${JUP}${mints.join(",")}`, 8000)) as Record<string, { usdPrice?: unknown }>;
      for (const mint of mints) spot.set(mint, num(json?.[mint]?.usdPrice));
    }
  } catch {
    /* spots stay null */
  }
  const rows = listed.map((p) => {
    const feedId = PRICE_ALIAS[`${p.from}-${p.to}`] ?? `${p.from}-${p.to}`;
    const row = rowFrom(feedId, laneFor(feedId), byPair, spot);
    row.base = p.from;
    row.quote = p.to;
    row.pairIndex = p.id;
    row.maxLeverage = p.maxLeverage > 0 ? p.maxLeverage / 100 : null;
    return row;
  });
  for (const id of extra) rows.push(rowFrom(id, laneFor(id), byPair, spot));
  return rows.sort((a, b) => a.lane.localeCompare(b.lane) || a.base.localeCompare(b.base));
}

export async function loadTape(): Promise<TapeRow[]> {
  const lists = await Promise.all(FEEDS.map((url) => getJson(url, 8000).catch(() => [])));
  const rows: TapeRow[] = [];
  const seen = new Set<string>();
  for (const json of lists) {
    if (!Array.isArray(json)) continue;
    for (const raw of json) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as {
        id?: unknown;
        symbol?: unknown;
        name?: unknown;
        usdPrice?: unknown;
        icon?: unknown;
        stats24h?: { priceChange?: unknown };
      };
      if (typeof row.id !== "string" || typeof row.symbol !== "string" || seen.has(row.id)) continue;
      if (rows.length >= 6000) break;
      seen.add(row.id);
      rows.push({
        id: row.id,
        symbol: row.symbol,
        name: typeof row.name === "string" && row.name ? row.name : row.symbol,
        price: num(row.usdPrice),
        change: num(row.stats24h?.priceChange),
        icon: typeof row.icon === "string" ? row.icon : undefined,
      });
    }
  }
  for (const hold of Object.values(HOLDS)) {
    if (!hold.mint || seen.has(hold.mint)) continue;
    seen.add(hold.mint);
    rows.push({ id: hold.mint, symbol: hold.symbol, name: hold.symbol, price: null, change: null });
  }
  return rows;
}

export const worldBook = createServerFn({ method: "GET" }).handler(async () => loadBook());

export const ostiumBook = createServerFn({ method: "GET" }).handler(async () => loadOstium());

export const jupTape = createServerFn({ method: "GET" }).handler(async () => loadTape());

/** A ticker Jupiter can quote, including names that are not on the verified list. Deepest pool first. */
export const searchTape = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const q = typeof input === "string" ? input : "";
    return q.trim().slice(0, 44);
  })
  .handler(async ({ data }): Promise<TapeRow[]> => {
    if (data.length < 2) return [];
    const json = await getJson(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(data)}`, 8000).catch(() => []);
    if (!Array.isArray(json)) return [];
    const rows: TapeRow[] = [];
    for (const raw of json) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as {
        id?: unknown;
        symbol?: unknown;
        name?: unknown;
        usdPrice?: unknown;
        icon?: unknown;
        liquidity?: unknown;
        stats24h?: { priceChange?: unknown };
      };
      if (typeof row.id !== "string" || row.id.length < 32 || typeof row.symbol !== "string") continue;
      rows.push({
        id: row.id,
        symbol: row.symbol,
        name: typeof row.name === "string" && row.name ? row.name : row.symbol,
        price: num(row.usdPrice),
        change: num(row.stats24h?.priceChange),
        icon: typeof row.icon === "string" ? row.icon : undefined,
        liquidity: num(row.liquidity) ?? undefined,
      });
    }
    rows.sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0));
    return rows.slice(0, 30);
  });
