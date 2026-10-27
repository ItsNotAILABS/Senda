/** Every verified Solana market Jupiter lists, one page at a time. Prices are Jupiter's. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";

const VERIFIED = "https://lite-api.jup.ag/tokens/v2/tag?query=verified";
const PAGE = 60;

export type Shelf = "all" | "crypto" | "majors" | "stocks" | "rwa" | "meme" | "launch" | "stakes" | "companies" | "cash" | "defi";

export type BookRow = {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  mcap: number;
  liquidity: number;
  decimals: number;
  shelf: Shelf;
  tags: string[];
  /** Set when this mint is not a retail swap. */
  note: string;
};

type Raw = {
  id?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  usdPrice?: number;
  mcap?: number;
  liquidity?: number;
  tags?: string[];
  stats24h?: { priceChange?: number };
};

const FUNDS: BookRow[] = [
  {
    mint: "EToDtBM2knZ8N1BHyUq2Riq5ngWTcoD3k6qpsgf7CKYY",
    symbol: "MONY",
    name: "J.P. Morgan My OnChain Net Yield",
    price: 1,
    change: 0,
    mcap: 0,
    liquidity: 0,
    decimals: 6,
    shelf: "cash",
    tags: ["stable"],
    note: "Live on Solana for qualified U.S. investors. Subscribe and redeem on Morgan Money. No retail pool, so this desk does not swap it.",
  },
  {
    mint: "J4cTuCH6frt4AnEmKfMS2k8hsUf7K94PV62sjUJno8Cz",
    symbol: "JLTXX",
    name: "JPMorgan OnChain Liquidity Token Money Market",
    price: 1,
    change: 0,
    mcap: 0,
    liquidity: 0,
    decimals: 6,
    shelf: "cash",
    tags: ["stable"],
    note: "Live on Solana. Registered government money market fund. Qualified investors use Morgan Money. Not a Jupiter retail swap.",
  },
];

function listed(tags: string[], shelf: Shelf): boolean {
  const t = new Set(tags);
  if (shelf === "stocks") return t.has("stocks") || t.has("xstocks") || t.has("equities") || t.has("backpack");
  if (shelf === "rwa") return t.has("rwa") || t.has("ondo") || t.has("commodities");
  if (shelf === "meme") return t.has("meme");
  if (shelf === "launch") return t.has("launchpad") || t.has("moonshot") || t.has("moonshot-verified");
  if (shelf === "stakes") return t.has("lst") || t.has("original-lst");
  if (shelf === "companies") return t.has("prestocks") || t.has("tessera") || t.has("pre-ipo");
  if (shelf === "cash") return t.has("stable");
  if (shelf === "defi") return t.has("defi") || t.has("jup-lend-earn") || t.has("yield");
  if (shelf === "majors") return t.has("major");
  return false;
}

function primary(tags: string[]): Shelf {
  const order: Shelf[] = ["companies", "majors", "stakes", "stocks", "rwa", "meme", "launch", "cash", "defi"];
  return order.find((shelf) => listed(tags, shelf)) || "crypto";
}

let slim: { at: number; rows: BookRow[] } | null = null;

async function catalog(): Promise<BookRow[]> {
  if (slim && Date.now() - slim.at < 120_000) return slim.rows;
  const r = await cachedJson(VERIFIED, 120_000);
  if (!r.ok || !Array.isArray(r.body)) throw new Error("The Solana book did not come back.");
  const rows: BookRow[] = [];
  const seen = new Set<string>();
  for (const raw of r.body as Raw[]) {
    const mint = raw.id || "";
    const symbol = (raw.symbol || "").trim();
    if (mint.length < 32 || !symbol || seen.has(mint)) continue;
    const price = Number(raw.usdPrice) || 0;
    if (!(price > 0)) continue;
    const tags = raw.tags || [];
    seen.add(mint);
    const fund = FUNDS.find((f) => f.mint === mint);
    rows.push({
      mint,
      symbol,
      name: raw.name || symbol,
      price,
      change: Number(raw.stats24h?.priceChange) || 0,
      mcap: Number(raw.mcap) || 0,
      liquidity: Number(raw.liquidity) || 0,
      decimals: Number.isFinite(Number(raw.decimals)) ? Number(raw.decimals) : 6,
      shelf: fund ? "cash" : primary(tags),
      tags: fund ? ["stable"] : tags,
      note: fund?.note || "",
    });
  }
  for (const fund of FUNDS) {
    if (!seen.has(fund.mint)) rows.push(fund);
  }
  rows.sort((a, b) => b.mcap - a.mcap || b.liquidity - a.liquidity || a.symbol.localeCompare(b.symbol));
  slim = { at: Date.now(), rows };
  return rows;
}

export const loadSolBook = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        shelf: z.enum(["all", "crypto", "majors", "stocks", "rwa", "meme", "launch", "stakes", "companies", "cash", "defi"]),
        page: z.number().int().min(0).max(400),
        q: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const q = (data.q || "").trim().toLowerCase();
    const all = (await catalog()).filter((row) => {
      if (data.shelf !== "all" && data.shelf !== "crypto" && !listed(row.tags, data.shelf) && !(data.shelf === "cash" && row.note)) return false;
      if (data.shelf === "crypto" && (row.shelf !== "crypto" || listed(row.tags, "meme"))) return false;
      if (!q) return true;
      return `${row.symbol} ${row.name}`.toLowerCase().includes(q);
    });
    const pages = Math.max(1, Math.ceil(all.length / PAGE));
    const page = Math.min(data.page, pages - 1);
    return { rows: all.slice(page * PAGE, page * PAGE + PAGE), page, pages, total: all.length };
  });
