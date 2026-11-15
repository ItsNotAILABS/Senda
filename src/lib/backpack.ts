/** Issued by Backpack Securities. Mints are the verified Jupiter set. A copy with the same ticker is not this list. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type BackpackName = { symbol: string; name: string; mint: string; decimals: number };

export const BACKPACK: BackpackName[] = [
  { symbol: "AAPL", name: "Apple", mint: "AAPLEDt8RpzPgXyhvFzkMBofvFSQw9gpeMCoUdPdLnB8", decimals: 6 },
  { symbol: "ABNB", name: "Airbnb", mint: "ABNB56TteaTZG1S3DY2W8VMncQmHMvNCGaZgAba49CLP", decimals: 6 },
  { symbol: "AMC", name: "AMC Entertainment", mint: "AMC1qwR9KhiyrQBRPrxnfo4JfMeMZqEBvt5tgTytNNoc", decimals: 6 },
  { symbol: "AMD", name: "Advanced Micro Devices", mint: "AMD8XwJXgQ9WV45Wyj9yFLejxzf2J6VM1PJY8bJEjeES", decimals: 6 },
  { symbol: "AMZN", name: "Amazon", mint: "AMZNw7cwU9L9c7ewZXxTws2PwQYxBGm2Rxg3FLDBJz9B", decimals: 6 },
  { symbol: "ARM", name: "Arm Holdings", mint: "ARMbSB1MBRQrY6PNMao1HdQ431VafC6JRJCsGZ2Yv3iJ", decimals: 6 },
  { symbol: "AVGO", name: "Broadcom", mint: "AVGoo4BQGsEfAmu4HU2deZTaTmLoqB3q3EzKXqAANGYD", decimals: 6 },
  { symbol: "BA", name: "The Boeing Company", mint: "BArimz1PcKZr8PcPh3tcZ2dg4S7FJLk3cw6R5F8GsHKg", decimals: 6 },
  { symbol: "BABA", name: "Alibaba Group Holding", mint: "BABANGA4JE7Kkam4nTrALAwAVgsNJUuFJnnkF7S16BZp", decimals: 6 },
  { symbol: "BB", name: "BlackBerry", mint: "BBosJLw8ZzoATiEyywiifx7AgmrD2Cm3XjFWbhbRhChy", decimals: 6 },
  { symbol: "BE", name: "Bloom Energy", mint: "BEBVfXZ8uCxRBuunEbW9wcq9r7W9ySNo14oJBJkDgpZx", decimals: 6 },
  { symbol: "BLK", name: "BlackRock", mint: "BLKKYfF41c6xRPrtX1rdYbxLE1xxEdZUnxQsB5hcZ8Nf", decimals: 6 },
  { symbol: "BOT", name: "RoboStrategy", mint: "BoTx8y9ynfdxf5ZjWtCoBVkff52qKA82ysaLU8ZM6d8T", decimals: 6 },
  { symbol: "BROS", name: "Dutch Bros", mint: "BRVaZKg6J9iF2BEsdpsxJ9NyvN9PPxPZuoQUX2v8qqkk", decimals: 6 },
  { symbol: "BULL", name: "Webull Corporation", mint: "BULL151gUXcFV5wXEUqu9Am2L7Qt4bTJRLRuAUjkcspC", decimals: 6 },
  { symbol: "CBRS", name: "Cerebras Systems", mint: "CBRSFBbQPpp77NpMcwbTN6fhBHmZM94oFLJvruytw4Fi", decimals: 6 },
  { symbol: "CHWY", name: "Chewy", mint: "CHWYHz2zfKajomqPV9it26n7vu7AgZZfqGHXCWtGWuJg", decimals: 6 },
  { symbol: "CMG", name: "Chipotle Mexican Grill", mint: "CMGi497VQA9RiHVWpQi5B847vN8RLaEwcMhB5kEUhkAQ", decimals: 6 },
  { symbol: "COPX", name: "Global X Copper Miners ETF", mint: "CzLTZppPdZtTjyq3WGpHLstoc3GLhu7zH5Zg6xUa6Gv5", decimals: 6 },
  { symbol: "COST", name: "Costco Wholesale", mint: "CZEB3WNZuF2Yz1z2H81RcCk8T7fsw82KB33zqamASVsg", decimals: 6 },
  { symbol: "CRWV", name: "CoreWeave", mint: "CRWVJeR2yEZuDUKYfGuKCHvLz8ywn4LGvovHfy5WiFmi", decimals: 6 },
  { symbol: "CYPH", name: "Cypherpunk Technologies", mint: "CYPHuMmCL1GxJWa2tsPhLKykC7GrHJTCHwbXD4g5uawK", decimals: 6 },
  { symbol: "DELL", name: "Dell Technologies", mint: "DELL2aRKQz7DMq5DrKLtkn47ZCnbxXPZXrSGbkmd13wy", decimals: 6 },
  { symbol: "DJT", name: "Trump Media & Technology Group Corp. Common Stock", mint: "DJTu7vi8norVzdVAffgvb39VP7wjKeTsgaMBJrzfxvoF", decimals: 6 },
  { symbol: "DKNG", name: "DraftKings", mint: "DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow", decimals: 6 },
  { symbol: "DNUT", name: "Krispy Kreme, Inc. Common Stock", mint: "DNUTsCvKbKwu2RM72cUuW3TD9YpzArzACcqYQssjPLSk", decimals: 6 },
  { symbol: "DRAM", name: "Roundhill Memory ETF", mint: "DRAMjSWR7HRfJKjRkvQWYL2bcaejaVhuxEcjf4pAY4Cw", decimals: 6 },
  { symbol: "EWY", name: "iShares MSCI South Korea ETF", mint: "EWY4owSJYMpwN33qGDu5gGxpkQkpMJu8ZUsQJaNZG5dv", decimals: 6 },
  { symbol: "EWZ", name: "iShares MSCI Brazil ETF", mint: "EWZzCki1igp2y73UyUM4RCG4QUVMQAtnrQUVNaDHzDxJ", decimals: 6 },
  { symbol: "FIG", name: "Figma", mint: "F2PYZNM8vfWLoTLNLpY8Un8yb7jeQ1V62gpsZZZeL9gm", decimals: 6 },
  { symbol: "FLWS", name: "1-800-FLOWERS.COM", mint: "FLWSojG1gB5VStYR3Sb4nQFRt43UBYkqih1j2CpVLqgd", decimals: 6 },
  { symbol: "FLY", name: "Firefly Aerospace", mint: "FLYRq3en8r2Z69gN3KyAnDrvnitEJNkwPYY7favinHeD", decimals: 6 },
  { symbol: "FWDI", name: "Forward Industries, Inc.", mint: "FWDtiB5fXHdVAewPqvHPL2dh4aBC1C6GacQbePoQXKjz", decimals: 6 },
  { symbol: "GPRO", name: "GoPro", mint: "GPRR2u6NS5yBQHWGauoJ9HXgjrTH8dDsrBfTV5zAYvDH", decimals: 6 },
  { symbol: "GRND", name: "Grindr", mint: "GRNDYDpqwpCm6jVxpbh4xT5AM4r3p391qYsKTHqgaET2", decimals: 6 },
  { symbol: "HIMS", name: "Hims & Hers Health", mint: "HiMSSzzwkZkrXJ4PGVJRdtfLaANeAztjjcgk5Dxe7Lwx", decimals: 6 },
  { symbol: "HOOD", name: "Robinhood Markets", mint: "HooDYv5RewLRiMLnEVq3VJqdqxhuE6c5eYvqejMC3e9A", decimals: 6 },
  { symbol: "HTZ", name: "Hertz Global Holdings, Inc Common Stock", mint: "HTZsLG4zqaNvWMwXSLHH3GG5KyJpKwpBRsKVdMG6hvzP", decimals: 6 },
  { symbol: "IBM", name: "International Business Machines", mint: "BMKdM4yUxX12moFqVk195k7coMbaybd4RUKCUdm7D1Sk", decimals: 6 },
  { symbol: "INTC", name: "Intel", mint: "iNTCy1qTsUEZQe3DSocLz1ZXXai34Gdw8THQh5rxFaF", decimals: 6 },
  { symbol: "IONQ", name: "IonQ", mint: "NQ5hSuXQZrbnrwcDVk2qN73njjd3E3v3badYHnj5thF", decimals: 6 },
  { symbol: "IREN", name: "IREN", mint: "RENzhrJQgmAnfcLhU1U5XwAMc6TC15UA6jCbPBaasnj", decimals: 6 },
  { symbol: "JNJ", name: "Johnson & Johnson", mint: "JNJg1znKdF712Phe7L7z52AATAvEjEytBdN2w8Lnh1Y", decimals: 6 },
  { symbol: "LLY", name: "Eli Lilly and Company", mint: "LLYuwZ33keFihgwoxXsBawy31AiRFLFSva32TYq5TvD", decimals: 6 },
  { symbol: "LMT", name: "Lockheed Martin", mint: "LMT3i1BHgixFqPUgcyteJhnEz2dpy9i3cYy4pi9BoeV", decimals: 6 },
  { symbol: "LULU", name: "lululemon athletica inc.", mint: "LULUmT9VMttkfAJE236LXJcYJ2tTP7nunrSWR5G1BdS", decimals: 6 },
  { symbol: "LUV", name: "Southwest Airlines Co.", mint: "LUV9GB51PNZNRyzzyYK3rtqFfvDvWtRiXZ34wVq2HrX", decimals: 6 },
  { symbol: "META", name: "Meta Platforms", mint: "METAaH6MMZZgy2CTEJq3QdNi7AFVTV3NxHFBfFgLEDd", decimals: 6 },
  { symbol: "MGM", name: "MGM Resorts International", mint: "MGMuubtUEirmkhfEQdmGUh4pr7HuUdMWcZXFtpPbVJD", decimals: 6 },
  { symbol: "MRNA", name: "Moderna", mint: "MRNAzXzhNcaEXJPibHEn8cd4vyekCDiivTyEwswLUCT", decimals: 6 },
  { symbol: "MRVL", name: "Marvell Technology", mint: "MRVLSjkR2ceUBukujaD3xCyHP1H3B2SzpsNTZF546jo", decimals: 6 },
  { symbol: "MSTR", name: "Strategy", mint: "MSTRdWXMeZxdE8osAQy3fA4rvTY5rgummDSMEx6U7Nz", decimals: 6 },
  { symbol: "MU", name: "Micron Technology", mint: "MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1", decimals: 6 },
  { symbol: "NBIS", name: "Nebius Group N.V.", mint: "NBiSF3UaVUFtRzHwAfxyHsBCAZWGEKnMpewAE4oh7BG", decimals: 6 },
  { symbol: "NFLX", name: "Netflix", mint: "NFLX7qV57zuVxCoHy3s1jiGZyALraLNwttbxdvmYJLJ", decimals: 6 },
  { symbol: "NKE", name: "Nike", mint: "NKEda5nHhNGgjrE9nDdMvaEmkmJ96qqxzBVZEcKmjSg", decimals: 6 },
  { symbol: "NOK", name: "Nokia Oyj", mint: "N7Q5fYX7YRnDQksfdBKnoUb3awm92n7QNAD35X3Rq1X", decimals: 6 },
  { symbol: "NVDA", name: "Nvidia", mint: "NVDAVuiB7hwd3m5Wa1JuHNovPaPG6BH1QNztbKFxNjv", decimals: 6 },
  { symbol: "PFE", name: "Pfizer", mint: "PFER6ENqP8r8NF3CqVt4mFowxsin3V5MLidBNQFCC3x", decimals: 6 },
  { symbol: "PTN", name: "Palatin Technologies, Inc.", mint: "PTNzAfFAB4LvoUQEUUGrFMyUoRLExMYjH6CcfyQfsVP", decimals: 6 },
  { symbol: "PUSA", name: "Powerus Corporation", mint: "PUSAG1stksTcAoK9MjinEHUwAYRJsbovywYCk37m6hy", decimals: 6 },
  { symbol: "QUBT", name: "Quantum Computing", mint: "QUBTAD8C9bMU9LvmMNgKPhrmBGbHvxpu6vfWQtThxxw", decimals: 6 },
  { symbol: "RACE", name: "Ferrari", mint: "RACEyWiM2ztEZcJx2AHXU2eWjhxU57x3vXn92b39dLD", decimals: 6 },
  { symbol: "RBLX", name: "Roblox", mint: "RBLXDGRD64AtRamHMFVcjqne3Ar7NLWtFtYNtsrf1cE", decimals: 6 },
  { symbol: "RDDT", name: "Reddit", mint: "RDDTGbhHwVXfyCvQMXzzowKjf5qrYBZAnehoXW83ooh", decimals: 6 },
  { symbol: "RIOT", name: "Riot Platforms", mint: "RUKx7nBgm94pwRPbVm99xYVdcTDTUyGs8Cw3VSYQXHf", decimals: 6 },
  { symbol: "RIVN", name: "Rivian Automotive", mint: "RcZmt84VMJv9bDhKqmw1uWDahYrUT468VwAChTnfD8p", decimals: 6 },
  { symbol: "RKLB", name: "Rocket Lab", mint: "RKLBnAXGqv31iZomqsuAWkQm1aqC7JwwvbCfzGdqAhz", decimals: 6 },
  { symbol: "RUM", name: "RUM Group Inc.", mint: "RUMsPfFZFnN1ZmGANwP7FNMJMjKH4m9RiMePrtVtLe7", decimals: 6 },
  { symbol: "SCHH", name: "Schwab U.S. REIT ETF", mint: "SCHHJ3jRdSjeFEVAaLrnYdx3Brphn92Ys7z1qkiCtPX", decimals: 6 },
  { symbol: "SHOP", name: "Shopify", mint: "SH55hfaipFAbwT42nQYhRoM5o5t61QpkmJ6p62vXB3m", decimals: 6 },
  { symbol: "SKHY", name: "SK Hynix", mint: "SKHYhSjuRWHgikq8eRKbtBbpABgJSkd7ytQV14i9EQ3", decimals: 6 },
  { symbol: "SNAP", name: "Snap", mint: "SNAPcESrvnH8yUdgeMF6xm1hym9b6hW6s8YeqeHdZFz", decimals: 6 },
  { symbol: "SNDK", name: "Sandisk", mint: "SNDKbwMUQvZhnLnxLduradgLHG5KrPuKwpnrkkGRhfH", decimals: 6 },
  { symbol: "SPCX", name: "SpaceX", mint: "SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb", decimals: 6 },
  { symbol: "SPHR", name: "Sphere Entertainment Co.", mint: "SPHRp8cZaSQBTp1KMNP4V1X821SXhXWt4Q2yLdyHzju", decimals: 6 },
  { symbol: "SQQQ", name: "ProShares UltraPro Short QQQ", mint: "SQQQAa3gUxgnqcEsdjPA4RQNQBgB97TnG2hJhk2WaGE", decimals: 6 },
  { symbol: "TSLA", name: "Tesla", mint: "TSLAqBbv4CNCnzWFeB7LmydAyEiNMJtve7DYKLpdK4S", decimals: 6 },
  { symbol: "TSM", name: "Taiwan Semiconductor Manufacturing Company", mint: "TSM2Hiuf7Z9REcwZFQvsBEekBYCYziWBABfFnj6V6gQ", decimals: 6 },
  { symbol: "TTWO", name: "Take-Two Interactive Software", mint: "TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo", decimals: 6 },
  { symbol: "UPS", name: "United Parcel Service", mint: "UPSqUeMHcWbkdg784XuBUEF9DtySSnW9ur5LAVdcuB9", decimals: 6 },
  { symbol: "URA", name: "Global X Uranium ETF", mint: "URARfsinxCRw4JpvQhuT4CxavdZXZEMjv9ZwWmWpwag", decimals: 6 },
  { symbol: "USO", name: "United States Oil Fund, LP", mint: "USNv3NkKA27Dh4nsHJDPhW4VoEcTQmjoZyJt2dqdwFu", decimals: 6 },
  { symbol: "UVXY", name: "ProShares Ultra VIX Short-Term Futures ETF", mint: "UVXY4ojmAMTaPwUmrRmcuxWHjMHCbz3BxX2RBMzjYKx", decimals: 6 },
  { symbol: "WEN", name: "The Wendy's Company", mint: "WENAZ2WyPbmgvUcKfQ8hyMDfBQP9bZ65hsZ5KTFrRGZ", decimals: 6 },
  { symbol: "WULF", name: "TeraWulf", mint: "WULFeyfrj1VJKD9HhRTcW8R4g5HefUA11HDEdBv2WxD", decimals: 6 },
  { symbol: "XYZ", name: "Block", mint: "XYZdVZ8jwqZCGN4XR7CiGkeWggo5huk7kNuXaCVs4nY", decimals: 6 },
];

export type BackpackRow = BackpackName & { price: number; change: number; liquidity: number; mcap: number; volume: number };

type Hit = {
  id?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  usdPrice?: number;
  liquidity?: number;
  mcap?: number;
  fdv?: number;
  holderCount?: number;
  circSupply?: number;
  organicScore?: number;
  organicScoreLabel?: string;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  isVerified?: boolean;
  createdAt?: string;
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number; numBuys?: number; numSells?: number; numTraders?: number };
  firstPool?: { createdAt?: string };
  audit?: { topHoldersPercentage?: number };
};

async function search(q: string, limit = 20): Promise<Hit[]> {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}&limit=${limit}`, {
    headers: { accept: "application/json", "user-agent": "Senda" },
  });
  if (!r.ok) throw new Error(`Jupiter ${r.status}`);
  const body = (await r.json()) as Hit[];
  return Array.isArray(body) ? body : [];
}

export const loadBackpack = createServerFn({ method: "GET" }).handler(async (): Promise<BackpackRow[]> => {
  const hits = await search("Backpack Securities", 100);
  const live = new Map<string, Hit>();
  for (const hit of hits) {
    if (!hit.id || !hit.name?.includes("Backpack Securities")) continue;
    if (hit.isVerified === false) continue;
    live.set(hit.id, hit);
  }
  const missing = BACKPACK.filter((n) => !live.has(n.mint)).map((n) => n.mint);
  if (missing.length) {
    const priced = await fetch(`https://lite-api.jup.ag/price/v3?ids=${missing.join(",")}`, {
      headers: { accept: "application/json", "user-agent": "Senda" },
    });
    if (priced.ok) {
      const book = (await priced.json()) as Record<string, { usdPrice?: number; priceChange24h?: number }>;
      for (const mint of missing) {
        const row = book[mint];
        if (row) live.set(mint, { id: mint, usdPrice: row.usdPrice, stats24h: { priceChange: row.priceChange24h } });
      }
    }
  }
  const known = new Set(BACKPACK.map((n) => n.mint));
  const extra: BackpackName[] = [];
  for (const hit of hits) {
    if (!hit.id || known.has(hit.id) || !hit.name?.includes("Backpack Securities") || hit.isVerified === false) continue;
    const symbol = (hit.symbol || "").replace(/[^A-Za-z0-9.]/g, "").slice(0, 12).toUpperCase();
    if (!symbol) continue;
    extra.push({ symbol, name: hit.name.replace(/ - Backpack Securities$/, ""), mint: hit.id, decimals: Number(hit.decimals) || 6 });
  }
  return [...BACKPACK, ...extra].map((n) => {
    const hit = live.get(n.mint);
    const stats = hit?.stats24h;
    return {
      ...n,
      price: Number(hit?.usdPrice) || 0,
      change: Number(stats?.priceChange) || 0,
      liquidity: Number(hit?.liquidity) || 0,
      mcap: Number(hit?.mcap) || 0,
      volume: Number(stats?.buyVolume || 0) + Number(stats?.sellVolume || 0),
    };
  });
});

export type BackpackCard = {
  liquidity: number;
  volume: number;
  buys: number;
  sells: number;
  traders: number;
  mcap: number;
  fdv: number;
  holders: number;
  supply: number;
  organic: number | null;
  organicLabel: string;
  mintAuthority: string;
  freezeAuthority: string;
  topHolders: number | null;
  poolCreated: string;
  price: number;
  change: number;
};

export const getBackpackCard = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ mint: z.string().min(32).max(48) }).parse(input))
  .handler(async ({ data }): Promise<BackpackCard | { error: string }> => {
    const hits = await search(data.mint);
    const hit = hits.find((row) => row.id === data.mint);
    if (!hit) return { error: "Jupiter has no card for that mint." };
    const stats = hit.stats24h || {};
    const auth = (v: string | null | undefined) => (v ? v : "—");
    return {
      liquidity: Number(hit.liquidity) || 0,
      volume: Number(stats.buyVolume || 0) + Number(stats.sellVolume || 0),
      buys: Number(stats.numBuys) || 0,
      sells: Number(stats.numSells) || 0,
      traders: Number(stats.numTraders) || 0,
      mcap: Number(hit.mcap) || 0,
      fdv: Number(hit.fdv) || 0,
      holders: Number(hit.holderCount) || 0,
      supply: Number(hit.circSupply) || 0,
      organic: typeof hit.organicScore === "number" ? hit.organicScore : null,
      organicLabel: hit.organicScoreLabel || "",
      mintAuthority: auth(hit.mintAuthority),
      freezeAuthority: auth(hit.freezeAuthority),
      topHolders: typeof hit.audit?.topHoldersPercentage === "number" ? hit.audit.topHoldersPercentage : null,
      poolCreated: hit.firstPool?.createdAt || hit.createdAt || "",
      price: Number(hit.usdPrice) || 0,
      change: Number(stats.priceChange) || 0,
    };
  });
