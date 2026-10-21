/** The product registry. Neon in production, the same table on the local fallback. */

import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { WORLD } from "@/lib/world-book";
import { SOLANA_MORE, CHAINS } from "@/lib/chain-tape-map.mjs";
import { EVM_MARKETS } from "@/lib/trade-book.mjs";
import { JUP_PERPS } from "@/lib/jup-perps";

export type OfferingRow = {
  id: string;
  family: string;
  symbol: string;
  name: string;
  chain: string;
  mint: string;
  venue: string;
  signPath: string;
  status: string;
  note: string;
};

type Draft = OfferingRow;

const STAKES: Draft[] = [
  { id: "stake:jitosol", family: "stake", symbol: "JitoSOL", name: "Jito staked SOL", chain: "Solana", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", venue: "Jito", signPath: "jupiter", status: "open", note: "SOL in. The token stays in the wallet." },
  { id: "stake:msol", family: "stake", symbol: "mSOL", name: "Marinade SOL", chain: "Solana", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", venue: "Marinade", signPath: "jupiter", status: "open", note: "SOL in. The token stays in the wallet." },
  { id: "stake:bsol", family: "stake", symbol: "bSOL", name: "BlazeStake SOL", chain: "Solana", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", venue: "Blaze", signPath: "jupiter", status: "open", note: "SOL in. The token stays in the wallet." },
  { id: "stake:jupsol", family: "stake", symbol: "JupSOL", name: "Jupiter staked SOL", chain: "Solana", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", venue: "Jupiter", signPath: "jupiter", status: "open", note: "SOL in. The token stays in the wallet." },
  { id: "stake:inf", family: "stake", symbol: "INF", name: "Sanctum INF", chain: "Solana", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", venue: "Sanctum", signPath: "jupiter", status: "open", note: "A pool of staked SOL." },
];

const LOANS: Draft[] = [
  { id: "loan:prestock", family: "loan", symbol: "NAME", name: "Borrow against a pre-IPO name", chain: "Solana", mint: "", venue: "Jupiter", signPath: "prestock", status: "open", note: "Sells up to half. Repay buys it back." },
  { id: "loan:listed", family: "loan", symbol: "SHARE", name: "Borrow against a listed share", chain: "Solana", mint: "", venue: "Jupiter", signPath: "jupiter", status: "open", note: "Only a share this wallet holds. Kamino is not signed here." },
];

const RAILS: Draft[] = [
  { id: "rail:usdc", family: "rail", symbol: "USDC", name: "Send USDC", chain: "Solana", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", venue: "Solana", signPath: "phantom", status: "open", note: "The wallet signs the transfer." },
];

const PERPS: Draft[] = [
  { id: "perp:drift-sol", family: "perp", symbol: "SOL-PERP", name: "SOL perpetual", chain: "Solana", mint: "", venue: "Drift", signPath: "drift", status: "open", note: "Signed on Solana." },
  { id: "perp:drift-btc", family: "perp", symbol: "BTC-PERP", name: "BTC perpetual", chain: "Solana", mint: "", venue: "Drift", signPath: "drift", status: "open", note: "Signed on Solana." },
  { id: "perp:drift-eth", family: "perp", symbol: "ETH-PERP", name: "ETH perpetual", chain: "Solana", mint: "", venue: "Drift", signPath: "drift", status: "open", note: "Signed on Solana." },
  ...JUP_PERPS.map((row) => ({
    id: `perp:jup-${row.asset.toLowerCase()}`,
    family: "perp",
    symbol: `${row.asset}-PERP`,
    name: `${row.asset} perpetual`,
    chain: "Solana",
    mint: row.mint,
    venue: "Jupiter",
    signPath: "jup-perps",
    status: "open",
    note: "Jupiter builds the order. Phantom signs it.",
  })),
];

function staticBook(): Draft[] {
  const stakeMints = new Set(STAKES.map((row) => row.mint));
  const rows: Draft[] = [...STAKES, ...LOANS, ...RAILS, ...PERPS];
  for (const asset of WORLD) {
    if (stakeMints.has(asset.mint)) continue;
    const family = asset.lane === "metals" ? "metal" : asset.lane === "fx" ? "fx" : "spot";
    rows.push({
      id: `${family}:${asset.id}`,
      family,
      symbol: asset.symbol,
      name: asset.name,
      chain: asset.chain,
      mint: asset.mint,
      venue: asset.via,
      signPath: "jupiter",
      status: "open",
      note: asset.note,
    });
  }
  for (const [symbol, name, mint] of SOLANA_MORE) {
    if (rows.some((row) => row.mint === mint)) continue;
    rows.push({
      id: `spot:${symbol.toLowerCase()}`,
      family: "spot",
      symbol,
      name,
      chain: "Solana",
      mint,
      venue: "Jupiter",
      signPath: "jupiter",
      status: "open",
      note: "Listed Solana market.",
    });
  }
  for (const market of EVM_MARKETS) {
    rows.push({
      id: `evm:${market.symbol.toLowerCase()}`,
      family: "spot",
      symbol: market.symbol,
      name: market.name,
      chain: market.chain,
      mint: market.token,
      venue: "LiFi",
      signPath: "lifi",
      status: "open",
      note: "The Ethereum address signs.",
    });
  }
  for (const [symbol, name, chain] of CHAINS) {
    rows.push({
      id: `chain:${symbol.toLowerCase()}`,
      family: "chain",
      symbol,
      name,
      chain,
      mint: "",
      venue: chain,
      signPath: "",
      status: "print",
      note: "The native chain. A wrapper on Solana or an EVM token is a different row.",
    });
  }
  rows.push({
    id: "chain:mon",
    family: "chain",
    symbol: "MON",
    name: "Monad",
    chain: "Monad",
    mint: "",
    venue: "Monad",
    signPath: "wallet",
    status: "chain",
    note: "Chain 143 can be added in the wallet. No swap is sent.",
  });
  return rows;
}

async function writeRows(sql: Sql, rows: Draft[]) {
  for (let i = 0; i < rows.length; i += 100) {
    const part = rows.slice(i, i + 100);
    await sql.query(
      `insert into offering (id, family, symbol, name, chain, mint, venue, sign_path, status, note, updated_at)
       select u.id, u.family, u.symbol, u.name, u.chain, u.mint, u.venue, u.sign_path, u.status, u.note, now()
       from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[])
         as u(id, family, symbol, name, chain, mint, venue, sign_path, status, note)
       on conflict (id) do nothing`,
      [
        part.map((row) => row.id),
        part.map((row) => row.family),
        part.map((row) => row.symbol),
        part.map((row) => row.name),
        part.map((row) => row.chain),
        part.map((row) => row.mint),
        part.map((row) => row.venue),
        part.map((row) => row.signPath),
        part.map((row) => row.status),
        part.map((row) => row.note),
      ],
    );
  }
}

const GRAPH = "https://api.subgraph.ormilabs.com/api/public/67a599d5-c8d2-4cc4-9c4d-2975a97bc5d8/subgraphs/ost-prod/live/gn";

async function ostiumDrafts(): Promise<Draft[]> {
  const res = await fetch(GRAPH, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Senda" },
    body: JSON.stringify({ query: "{ pairs(first: 200) { id from to maxLeverage } }" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { pairs?: { id?: string; from?: string; to?: string; maxLeverage?: string }[] } };
  return (json.data?.pairs ?? [])
    .filter((pair) => pair.from && pair.to && pair.id != null)
    .map((pair) => {
      const max = Number(pair.maxLeverage) || 0;
      return {
        id: `ostium:${pair.id}`,
        family: "ostium",
        symbol: `${pair.from}/${pair.to}`,
        name: `${pair.from} / ${pair.to}`,
        chain: "Arbitrum",
        mint: "",
        venue: "Ostium",
        signPath: "arbitrum",
        status: "open",
        note: max > 0 ? `Up to ${max / 100}x. USDC on Arbitrum.` : "USDC on Arbitrum. The Ethereum account signs.",
      };
    });
}

let hlAt = 0;
let hlRows: Draft[] = [];

async function hlDrafts(): Promise<Draft[]> {
  if (hlRows.length && Date.now() - hlAt < 10 * 60_000) return hlRows;
  const info = "https://api.hyperliquid.xyz/info";
  const post = async (body: unknown) => {
    const res = await fetch(info, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Senda" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Hyperliquid ${res.status}`);
    return res.json();
  };
  const dexes = (await post({ type: "perpDexs" })) as Array<{ name?: string } | null>;
  const rows: Draft[] = [];
  for (const dex of dexes) {
    const name = dex && typeof dex === "object" ? dex.name || "" : "";
    const meta = (await post(name ? { type: "meta", dex: name } : { type: "meta" })) as {
      universe?: { name?: string; maxLeverage?: number }[];
    };
    const label = name || "main";
    for (const market of meta.universe ?? []) {
      if (!market.name) continue;
      const max = Number(market.maxLeverage) || 0;
      rows.push({
        id: `hl:${label}:${market.name}`.toLowerCase(),
        family: "perp",
        symbol: market.name.slice(0, 24),
        name: `${market.name} perpetual`.slice(0, 80),
        chain: "Hyperliquid",
        mint: "",
        venue: `Hyperliquid ${label}`,
        signPath: "hyperliquid",
        status: "open",
        note: max > 0 ? `Up to ${max}x. The Ethereum account signs.` : "The Ethereum account signs.",
      });
    }
  }
  const spot = (await post({ type: "spotMeta" })) as { universe?: { name?: string }[] };
  for (const market of spot.universe ?? []) {
    if (!market.name) continue;
    rows.push({
      id: `hlspot:${market.name}`.toLowerCase(),
      family: "hl-spot",
      symbol: market.name.slice(0, 24),
      name: market.name.slice(0, 80),
      chain: "Hyperliquid",
      mint: "",
      venue: "Hyperliquid spot",
      signPath: "hyperliquid",
      status: "open",
      note: "Hyperliquid spot. The Ethereum account signs.",
    });
  }
  hlRows = rows;
  hlAt = Date.now();
  return rows;
}

async function liveExtras(): Promise<Draft[]> {
  const out: Draft[] = [];
  try {
    const { fetchHouse } = await import("./sol-house");
    const rows = await fetchHouse();
    for (const row of rows) {
      if (!row.mint || !row.symbol) continue;
      out.push({
        id: `name:${row.mint}`,
        family: "name",
        symbol: row.symbol,
        name: row.name,
        chain: "Solana",
        mint: row.mint,
        venue: row.venue,
        signPath: "prestock",
        status: row.last > 0 ? "open" : "listed",
        note: "The wallet signs the swap. The token stays in the wallet.",
      });
    }
  } catch {
    /* names still register the next time the house loads */
  }
  try {
    const { fetchEquityBook } = await import("./equities");
    const book = await fetchEquityBook();
    for (const row of book.stocks) {
      if (!row.mint || !row.symbol) continue;
      out.push({
        id: `listed:${row.mint}`,
        family: "listed",
        symbol: row.symbol,
        name: row.name || row.symbol,
        chain: "Solana",
        mint: row.mint,
        venue: "xStock",
        signPath: "jupiter",
        status: row.open ? "open" : "listed",
        note: row.open ? "A listed share. The wallet signs." : "Listed, not open for a swap right now.",
      });
    }
  } catch {
    /* shares still register when the listed book loads */
  }
  try {
    out.push(...(await tapeDrafts()));
  } catch {
    /* the Jupiter book stays as it was */
  }
  try {
    out.push(...(await ostiumDrafts()));
  } catch {
    /* the Arbitrum book stays as it was */
  }
  try {
    out.push(...(await hlDrafts()));
  } catch {
    /* the Hyperliquid book stays as it was */
  }
  try {
    const { driftMarkets } = await import("./drift-book");
    for (const row of driftMarkets()) {
      out.push({
        id: `drift:${row.symbol.toLowerCase()}`,
        family: "perp",
        symbol: `${row.symbol}-PERP`,
        name: `${row.symbol} perpetual`,
        chain: "Solana",
        mint: "",
        venue: "Drift",
        signPath: "drift",
        status: "open",
        note: "Drift perp. SOL, ETH, and BTC are the ones this desk can sign.",
      });
    }
  } catch {
    /* the Drift book stays as it was */
  }
  return out;
}

const TAPE = [
  "https://api.jup.ag/tokens/v2/tag?query=verified",
  "https://api.jup.ag/tokens/v2/tag?query=lst",
  "https://api.jup.ag/tokens/v2/tag?query=stocks",
];

async function tapeDrafts(): Promise<Draft[]> {
  const seen = new Set<string>();
  const rows: Draft[] = [];
  const pages = await Promise.all(
    TAPE.map(async (url) => {
      try {
        const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda" }, signal: AbortSignal.timeout(20000) });
        if (!res.ok) return [];
        return (await res.json()) as Array<{ id?: string; symbol?: string; name?: string }>;
      } catch {
        return [];
      }
    }),
  );
  for (const page of pages) {
    const list = Array.isArray(page) ? page : [];
    for (const row of list) {
      const mint = String(row.id ?? "");
      const symbol = String(row.symbol ?? "").slice(0, 24);
      if (mint.length < 32 || !symbol || seen.has(mint)) continue;
      seen.add(mint);
      const stock = /x$/i.test(symbol);
      rows.push({
        id: `${stock ? "listed" : "spot"}:${mint}`,
        family: stock ? "listed" : "spot",
        symbol,
        name: String(row.name || symbol).slice(0, 80),
        chain: "Solana",
        mint,
        venue: stock ? "xStock" : "Jupiter",
        signPath: "jupiter",
        status: "open",
        note: "On the Jupiter book Phantom signs.",
      });
    }
  }
  return rows;
}

export async function registerOfferings(extra: Draft[] = []): Promise<number> {
  const sql = await getSql();
  const seen = new Set<string>();
  const rows: Draft[] = [];
  for (const row of [...staticBook(), ...extra]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  const have = await sql<{ id: string }>`select id from offering`;
  const known = new Set(have.map((row) => row.id));
  await writeRows(sql, rows.filter((row) => !known.has(row.id)));
  return known.size + rows.filter((row) => !known.has(row.id)).length;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export const syncOfferings = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = (input ?? {}) as { rows?: Draft[] };
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2000) : [];
    return rows
      .filter((row) => row && typeof row.id === "string" && typeof row.symbol === "string" && typeof row.name === "string")
      .map((row) => ({
        id: row.id.slice(0, 80),
        family: asText(row.family).slice(0, 24) || "name",
        symbol: row.symbol.slice(0, 24),
        name: row.name.slice(0, 80),
        chain: asText(row.chain).slice(0, 32),
        mint: asText(row.mint).slice(0, 80),
        venue: asText(row.venue).slice(0, 40),
        signPath: asText(row.signPath).slice(0, 24),
        status: asText(row.status).slice(0, 16) || "open",
        note: asText(row.note).slice(0, 180),
      }));
  })
  .handler(async ({ data }) => {
    const count = await registerOfferings(data);
    return { count };
  });

export const listOfferings = createServerFn({ method: "GET" }).handler(async () => {
  await registerOfferings(await liveExtras());
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    family: string;
    symbol: string;
    name: string;
    chain: string;
    mint: string;
    venue: string;
    sign_path: string;
    status: string;
    note: string;
  }>`
    select id, family, symbol, name, chain, mint, venue, sign_path, status, note
    from offering
    order by family, symbol
    limit 12000
  `;
  return rows.map((row) => ({
    id: row.id,
    family: row.family,
    symbol: row.symbol,
    name: row.name,
    chain: row.chain,
    mint: row.mint,
    venue: row.venue,
    signPath: row.sign_path,
    status: row.status,
    note: row.note,
  }));
});

export const patchOffering = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = (input ?? {}) as { id?: string; status?: string; note?: string };
    const id = asText(body.id).slice(0, 80);
    if (!id) throw new Error("Name the offering.");
    return {
      id,
      status: body.status == null ? null : asText(body.status).slice(0, 16),
      note: body.note == null ? null : asText(body.note).slice(0, 180),
    };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (data.status != null) {
      await sql`update offering set status = ${data.status}, updated_at = now() where id = ${data.id}`;
    }
    if (data.note != null) {
      await sql`update offering set note = ${data.note}, updated_at = now() where id = ${data.id}`;
    }
    return { id: data.id };
  });
