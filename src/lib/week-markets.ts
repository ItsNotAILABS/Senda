/** Backpack Securities mints Jupiter returned by name. Liquidity is read live. A post's weekly volume is not a pool. */

export type WeekName = {
  symbol: string;
  mint: string;
  issuer: "Backpack Securities" | "Hastra";
};

export const WEEK: WeekName[] = [
  { symbol: "SPCX", mint: "SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb", issuer: "Backpack Securities" },
  { symbol: "TTWO", mint: "TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo", issuer: "Backpack Securities" },
  { symbol: "MU", mint: "MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1", issuer: "Backpack Securities" },
  { symbol: "SKHY", mint: "SKHYhSjuRWHgikq8eRKbtBbpABgJSkd7ytQV14i9EQ3", issuer: "Backpack Securities" },
  { symbol: "TSLA", mint: "TSLAqBbv4CNCnzWFeB7LmydAyEiNMJtve7DYKLpdK4S", issuer: "Backpack Securities" },
  { symbol: "DJT", mint: "DJTu7vi8norVzdVAffgvb39VP7wjKeTsgaMBJrzfxvoF", issuer: "Backpack Securities" },
  { symbol: "NVDA", mint: "NVDAVuiB7hwd3m5Wa1JuHNovPaPG6BH1QNztbKFxNjv", issuer: "Backpack Securities" },
  { symbol: "META", mint: "METAaH6MMZZgy2CTEJq3QdNi7AFVTV3NxHFBfFgLEDd", issuer: "Backpack Securities" },
  { symbol: "SNDK", mint: "SNDKbwMUQvZhnLnxLduradgLHG5KrPuKwpnrkkGRhfH", issuer: "Backpack Securities" },
  { symbol: "AAPL", mint: "AAPLEDt8RpzPgXyhvFzkMBofvFSQw9gpeMCoUdPdLnB8", issuer: "Backpack Securities" },
  { symbol: "AMZN", mint: "AMZNw7cwU9L9c7ewZXxTws2PwQYxBGm2Rxg3FLDBJz9B", issuer: "Backpack Securities" },
  { symbol: "AMD", mint: "AMD8XwJXgQ9WV45Wyj9yFLejxzf2J6VM1PJY8bJEjeES", issuer: "Backpack Securities" },
  { symbol: "MSTR", mint: "MSTRdWXMeZxdE8osAQy3fA4rvTY5rgummDSMEx6U7Nz", issuer: "Backpack Securities" },
  { symbol: "MSFT", mint: "MSFThX899B1DddH5jkyMpdArWXzP85VXLYDrbGGcRJM", issuer: "Backpack Securities" },
  { symbol: "RACE", mint: "RACEyWiM2ztEZcJx2AHXU2eWjhxU57x3vXn92b39dLD", issuer: "Backpack Securities" },
  { symbol: "NFLX", mint: "NFLX7qV57zuVxCoHy3s1jiGZyALraLNwttbxdvmYJLJ", issuer: "Backpack Securities" },
  { symbol: "GOOGL", mint: "GooGLMvZtJZXHdNZy95RUrAMCCKxV6ghK3qE5ddBgVm5", issuer: "Backpack Securities" },
  { symbol: "HIMS", mint: "HiMSSzzwkZkrXJ4PGVJRdtfLaANeAztjjcgk5Dxe7Lwx", issuer: "Backpack Securities" },
  { symbol: "DRAM", mint: "DRAMjSWR7HRfJKjRkvQWYL2bcaejaVhuxEcjf4pAY4Cw", issuer: "Backpack Securities" },
  { symbol: "SQQQ", mint: "SQQQAa3gUxgnqcEsdjPA4RQNQBgB97TnG2hJhk2WaGE", issuer: "Backpack Securities" },
  { symbol: "BLK", mint: "BLKKYfF41c6xRPrtX1rdYbxLE1xxEdZUnxQsB5hcZ8Nf", issuer: "Backpack Securities" },
  { symbol: "RBLX", mint: "RBLXDGRD64AtRamHMFVcjqne3Ar7NLWtFtYNtsrf1cE", issuer: "Backpack Securities" },
  { symbol: "LLY", mint: "LLYuwZ33keFihgwoxXsBawy31AiRFLFSva32TYq5TvD", issuer: "Backpack Securities" },
  { symbol: "LMT", mint: "LMT3i1BHgixFqPUgcyteJhnEz2dpy9i3cYy4pi9BoeV", issuer: "Backpack Securities" },
  { symbol: "SNAP", mint: "SNAPcESrvnH8yUdgeMF6xm1hym9b6hW6s8YeqeHdZFz", issuer: "Backpack Securities" },
  { symbol: "IBM", mint: "BMKdM4yUxX12moFqVk195k7coMbaybd4RUKCUdm7D1Sk", issuer: "Backpack Securities" },
  { symbol: "HOOD", mint: "HooDYv5RewLRiMLnEVq3VJqdqxhuE6c5eYvqejMC3e9A", issuer: "Backpack Securities" },
  { symbol: "COST", mint: "CZEB3WNZuF2Yz1z2H81RcCk8T7fsw82KB33zqamASVsg", issuer: "Backpack Securities" },
  { symbol: "MRVL", mint: "MRVLSjkR2ceUBukujaD3xCyHP1H3B2SzpsNTZF546jo", issuer: "Backpack Securities" },
  { symbol: "CHWY", mint: "CHWYHz2zfKajomqPV9it26n7vu7AgZZfqGHXCWtGWuJg", issuer: "Backpack Securities" },
  { symbol: "EWY", mint: "EWY4owSJYMpwN33qGDu5gGxpkQkpMJu8ZUsQJaNZG5dv", issuer: "Backpack Securities" },
  { symbol: "INTC", mint: "iNTCy1qTsUEZQe3DSocLz1ZXXai34Gdw8THQh5rxFaF", issuer: "Backpack Securities" },
  { symbol: "ARM", mint: "ARMbSB1MBRQrY6PNMao1HdQ431VafC6JRJCsGZ2Yv3iJ", issuer: "Backpack Securities" },
  { symbol: "TSM", mint: "TSM2Hiuf7Z9REcwZFQvsBEekBYCYziWBABfFnj6V6gQ", issuer: "Backpack Securities" },
  { symbol: "SCHH", mint: "SCHHJ3jRdSjeFEVAaLrnYdx3Brphn92Ys7z1qkiCtPX", issuer: "Backpack Securities" },
  { symbol: "ABNB", mint: "ABNB56TteaTZG1S3DY2WMncQmHMvNCGaZgAba49CLP", issuer: "Backpack Securities" },
  { symbol: "AVGO", mint: "AVGoo4BQGsEfAmu4HU2deZTaTmLoqB3q3EzKXqAANGYD", issuer: "Backpack Securities" },
  { symbol: "AUTO", mint: "GNE6oDS6jHrfaV3GQVVCCp37fDnT7PiPuewMKBj2bqNm", issuer: "Hastra" },
];

export type WeekRow = WeekName & { name: string; price: number; liquidity: number; holders: number };

type Hit = { id?: string; symbol?: string; name?: string; usdPrice?: number; liquidity?: number; holderCount?: number };

async function one(row: WeekName): Promise<WeekRow | null> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${row.mint}`, {
      headers: { accept: "application/json", "user-agent": "Senda" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Hit[];
    const hit = (Array.isArray(body) ? body : []).find((item) => item.id === row.mint);
    if (!hit) return null;
    const name = hit.name || "";
    if (row.issuer === "Backpack Securities" && !name.includes("Backpack Securities")) return null;
    if (row.issuer === "Hastra" && !name.includes("Hastra")) return null;
    return {
      ...row,
      name,
      price: Number(hit.usdPrice) || 0,
      liquidity: Number(hit.liquidity) || 0,
      holders: Number(hit.holderCount) || 0,
    };
  } catch {
    return null;
  }
}

/** Four at a time. A burst of thirty searches gets refused. */
export async function loadWeek(): Promise<WeekRow[]> {
  const out: WeekRow[] = [];
  for (let i = 0; i < WEEK.length; i += 4) {
    const part = await Promise.all(WEEK.slice(i, i + 4).map(one));
    for (const row of part) if (row) out.push(row);
  }
  return out.sort((a, b) => b.liquidity - a.liquidity);
}
