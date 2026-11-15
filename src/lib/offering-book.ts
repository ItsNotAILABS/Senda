/** Product register. A new row is inserted. A row that is already stored is not rewritten. */

import { createServerFn } from "@tanstack/react-start";
import { CHAIN_LANES } from "@/lib/chain-book";
import { getSql, type Sql } from "@/lib/db";
import { PERP_MARKETS } from "@/lib/jup-perps";
import { PAIR_MARKETS } from "@/lib/market-catalog";
import { BACKPACK } from "@/lib/backpack";
import { SWAP_BOOK, type SwapGroup } from "@/lib/swap-book";
import { DERIVS } from "@/lib/deriv-book";
import { listedPrints } from "@/lib/world-book";
import { loadKaminoVaults } from "@/lib/vault-book";

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

const STRUCTURES: Draft[] = [
  { id: "stake:jitosol", family: "stake", symbol: "JitoSOL", name: "Jito staked SOL", chain: "Solana", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", venue: "Jito", signPath: "jupiter", status: "open", note: "SOL in. The token stays in the wallet." },
  { id: "stake:msol", family: "stake", symbol: "mSOL", name: "Marinade SOL", chain: "Solana", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", venue: "Marinade", signPath: "jupiter", status: "open", note: "SOL in. The token stays in the wallet." },
  { id: "stake:bsol", family: "stake", symbol: "bSOL", name: "BlazeStake SOL", chain: "Solana", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", venue: "Blaze", signPath: "jupiter", status: "open", note: "SOL in. The token stays in the wallet." },
  { id: "stake:jupsol", family: "stake", symbol: "JupSOL", name: "Jupiter staked SOL", chain: "Solana", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", venue: "Jupiter", signPath: "jupiter", status: "open", note: "SOL in. The token stays in the wallet." },
  { id: "stake:inf", family: "stake", symbol: "INF", name: "Sanctum INF", chain: "Solana", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", venue: "Sanctum", signPath: "jupiter", status: "open", note: "A pool of staked SOL." },
  { id: "loan:name", family: "loan", symbol: "NAME", name: "Borrow against a pre-IPO name", chain: "Solana", mint: "", venue: "Senda", signPath: "prestock", status: "open", note: "Only against a name this wallet holds." },
  { id: "loan:share", family: "loan", symbol: "SHARE", name: "Borrow against a listed share", chain: "Solana", mint: "", venue: "Senda", signPath: "jupiter", status: "open", note: "Only a share this wallet holds." },
  { id: "rail:usdc", family: "rail", symbol: "USDC", name: "Send USDC", chain: "Solana", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", venue: "Solana", signPath: "phantom", status: "open", note: "The wallet signs the transfer." },
  { id: "option:call", family: "option", symbol: "CALL", name: "Call on a pre-IPO name", chain: "Solana", mint: "", venue: "Senda", signPath: "prestock", status: "open", note: "Premium in USDC. The name stays in the wallet." },
  { id: "option:put", family: "option", symbol: "PUT", name: "Put on a pre-IPO name", chain: "Solana", mint: "", venue: "Senda", signPath: "prestock", status: "open", note: "Premium in USDC. The name stays in the wallet." },
  { id: "cover:drop", family: "cover", symbol: "COVER", name: "Downside cover", chain: "Solana", mint: "", venue: "Senda", signPath: "prestock", status: "open", note: "A premium against a drop. The token is not sold." },
  { id: "cctp:eth-base", family: "rail", symbol: "USDC", name: "USDC Ethereum to Base", chain: "Ethereum", mint: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", venue: "CCTP", signPath: "cctp", status: "open", note: "Phantom burns on Ethereum and mints on Base." },
  { id: "cctp:base-eth", family: "rail", symbol: "USDC", name: "USDC Base to Ethereum", chain: "Base", mint: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", venue: "CCTP", signPath: "cctp", status: "open", note: "Phantom burns on Base and mints on Ethereum." },
  { id: "cctp:arb-export", family: "rail", symbol: "USDC", name: "USDC via Arbitrum", chain: "Arbitrum", mint: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", venue: "CCTP", signPath: "cctp", status: "print", note: "Phantom's network list excludes Arbitrum. The payload is exported. There is no mint button." },
  { id: "chain:robinhood-stocks", family: "listed", symbol: "RH", name: "Robinhood Chain stock tokens", chain: "Robinhood Chain", mint: "", venue: "Robinhood", signPath: "wallet", status: "chain", note: "Chain 4663. Chainlink prices the stock tokens. US persons are excluded. Senda adds the chain. It does not invent the swap." },
  { id: "desk:backpack", family: "listed", symbol: "BACKPACK", name: "Backpack Securities book", chain: "Solana", mint: "", venue: "Backpack Securities", signPath: "jupiter", status: "open", note: "Every mint Jupiter names as Backpack Securities. The pool is live. The wallet signs." },
  { id: "desk:ondo", family: "listed", symbol: "ONDO", name: "Ondo book", chain: "Solana", mint: "", venue: "Ondo", signPath: "jupiter", status: "open", note: "Ondo names on the verified list. The wallet signs the swap." },
  { id: "desk:drift", family: "perp", symbol: "DRIFT", name: "Drift perps", chain: "Solana", mint: "", venue: "Drift", signPath: "drift", status: "open", note: "The Drift book. SOL, ETH, and BTC can be signed. The rest are listed." },
  { id: "desk:phoenix", family: "spot", symbol: "PHOENIX", name: "Phoenix book", chain: "Solana", mint: "", venue: "Phoenix", signPath: "jupiter", status: "open", note: "On-chain book. The wallet signs." },
  { id: "desk:hyperliquid", family: "perp", symbol: "HL", name: "Hyperliquid book", chain: "Hyperliquid", mint: "", venue: "Hyperliquid", signPath: "hyperliquid", status: "open", note: "The Ethereum account signs. Margin stays there." },
  { id: "rail:gift", family: "rail", symbol: "GIFT", name: "USDC gift", chain: "Solana", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", venue: "Senda", signPath: "phantom", status: "open", note: "USDC sits until it is claimed. The wallet signs the fund." },
  { id: "loan:kamino-usdc", family: "loan", symbol: "USDC", name: "Kamino USDC market", chain: "Solana", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", venue: "Kamino", signPath: "kamino", status: "open", note: "Supply rate on the main market. A Jupiter buy of USDC does not start it." },
  { id: "desk:meteora", family: "spot", symbol: "METEORA", name: "Meteora pools", chain: "Solana", mint: "", venue: "Meteora", signPath: "jupiter", status: "open", note: "DLMM liquidity beside the route. Senda does not hold the pool." },
  { id: "desk:raydium", family: "spot", symbol: "RAYDIUM", name: "Raydium pools", chain: "Solana", mint: "", venue: "Raydium", signPath: "jupiter", status: "open", note: "AMM pools. The wallet signs a Jupiter route that may use them." },
  { id: "desk:screen", family: "spot", symbol: "SCREEN", name: "Liquid screener", chain: "Solana", mint: "", venue: "Jupiter", signPath: "jupiter", status: "open", note: "Names with at least $25,000 in the pool, sorted deepest first." },
];

const FAMILY: Record<string, string> = {
  fx: "fx",
  metals: "metal",
  energy: "commodity",
  softs: "commodity",
  index: "index",
  crypto: "spot",
  shares: "listed",
};

function staticBook(): Draft[] {
  const rows: Draft[] = [...STRUCTURES];
  for (const print of listedPrints()) {
    rows.push({
      id: `print:${print.id}`,
      family: FAMILY[print.lane] ?? "spot",
      symbol: print.symbol,
      name: print.id.replace("-", " / "),
      chain: print.mint ? "Solana" : "Arbitrum",
      mint: print.mint,
      venue: print.mint ? "Jupiter" : "Ostium",
      signPath: print.mint ? "jupiter" : "arbitrum",
      status: print.mint ? "open" : "print",
      note: print.note,
    });
  }
  for (const market of PAIR_MARKETS) {
    rows.push({
      id: `pair:${market.id}`,
      family: market.group === "metal" ? "metal" : market.group === "fx" ? "fx" : market.group === "meme" ? "meme" : "spot",
      symbol: market.symbol,
      name: market.name,
      chain: "Solana",
      mint: market.mint ?? "",
      venue: market.mint ? "Jupiter" : "Ostium",
      signPath: market.mint ? "jupiter" : "arbitrum",
      status: market.mint ? "open" : "print",
      note: market.ostium ? `Ostium print ${market.ostium}.` : "Jupiter quote. The wallet signs.",
    });
  }
  for (const market of PERP_MARKETS) {
    rows.push({
      id: `perp:jup-${market.asset.toLowerCase()}`,
      family: "perp",
      symbol: `${market.asset}-PERP`,
      name: `${market.name} perpetual`,
      chain: "Solana",
      mint: market.mint,
      venue: "Jupiter",
      signPath: "jup-perps",
      status: "open",
      note: "Jupiter builds the order. Phantom signs it.",
    });
  }
  for (const lane of CHAIN_LANES) {
    rows.push({
      id: `chain:${lane.id}`,
      family: "chain",
      symbol: lane.name.toUpperCase(),
      name: lane.name,
      chain: lane.name,
      mint: "",
      venue: lane.name,
      signPath: lane.live ? "wallet" : "",
      status: lane.live ? "open" : "chain",
      note: lane.clears,
    });
  }
  return rows;
}

const SWAP_FAMILY: Record<SwapGroup, string> = {
  Cash: "spot",
  DeFi: "spot",
  Memes: "meme",
  Staked: "stake",
  Stocks: "listed",
  Metals: "metal",
  FX: "fx",
  Commodities: "commodity",
  PreStocks: "name",
};

function registeredMarkets(): Draft[] {
  const rows: Draft[] = [];
  for (const coin of SWAP_BOOK) {
    rows.push({
      id: `swap:${coin.mint}`,
      family: SWAP_FAMILY[coin.group],
      symbol: coin.symbol,
      name: coin.name,
      chain: "Solana",
      mint: coin.mint,
      venue: "Jupiter",
      signPath: "jupiter",
      status: "open",
      note: "On the swap list. Jupiter quotes it. The wallet signs.",
    });
  }
  for (const row of BACKPACK) {
    rows.push({
      id: `security:${row.mint}`,
      family: "listed",
      symbol: row.symbol,
      name: row.name,
      chain: "Solana",
      mint: row.mint,
      venue: "Backpack Securities",
      signPath: "jupiter",
      status: "open",
      note: "Backpack Securities mint. A same-ticker copy is a different row. The wallet signs.",
    });
  }
  for (const row of DERIVS) {
    const hold = row.hold;
    rows.push({
      id: `deriv:${row.id}`,
      family: row.lane === "metals" ? "metal" : row.lane === "fx" ? "fx" : row.lane === "energy" || row.lane === "softs" ? "commodity" : row.lane === "index" ? "index" : row.lane === "shares" ? "listed" : "perp",
      symbol: `${row.base}/${row.quote}`,
      name: `${row.base} / ${row.quote}`,
      chain: hold ? "Solana" : row.ostium ? "Arbitrum" : "Base",
      mint: hold?.mint ?? "",
      venue: hold ? "Jupiter" : row.ostium ? "Ostium" : "Avantis",
      signPath: hold ? "jupiter" : row.ostium ? "arbitrum" : "",
      status: "open",
      note: hold
        ? `${hold.note} The perp is a separate row.`
        : row.ostium
          ? `Ostium print ${row.ostium}. No Solana token on this row.`
          : row.avantis
            ? `Avantis print ${row.avantis}. No Solana token on this row.`
            : "Listed pair. No token on this row.",
    });
  }
  return rows;
}

const GRAPH = "https://api.subgraph.ormilabs.com/api/public/67a599d5-c8d2-4cc4-9c4d-2975a97bc5d8/subgraphs/ost-prod/live/gn";

async function liveExtras(): Promise<Draft[]> {
  const out: Draft[] = [];
  try {
    const { fetchHouse } = await import("./sol-house");
    for (const row of await fetchHouse()) {
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
    /* the house still registers from its own page */
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
        note: row.open ? "A listed share. The wallet signs." : "Listed. The session is not open for a swap.",
      });
    }
  } catch {
    /* shares still register when that book loads */
  }
  try {
    const res = await fetch(GRAPH, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Senda" },
      body: JSON.stringify({ query: "{ pairs(first: 1000) { id from to maxLeverage } }" }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: { pairs?: { id?: string; from?: string; to?: string; maxLeverage?: string }[] } };
      for (const pair of json.data?.pairs ?? []) {
        if (!pair.from || !pair.to || pair.id == null) continue;
        const max = Number(pair.maxLeverage) || 0;
        out.push({
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
        });
      }
    }
  } catch {
    /* the Arbitrum book stays as stored */
  }
  try {
    for (const vault of await loadKaminoVaults()) {
      out.push({
        id: `vault:kamino:${vault.address}`,
        family: "vault",
        symbol: vault.name.slice(0, 24),
        name: vault.name,
        chain: "Solana",
        mint: vault.sharesMint,
        venue: "Kamino",
        signPath: "jupiter",
        status: "open",
        note: vault.perfBps > 0 ? `Share token. Jupiter quotes it. Performance fee ${(vault.perfBps / 100).toFixed(2)}%. Senda does not deposit.` : "Share token. Jupiter quotes it. Senda does not deposit.",
      });
    }
  } catch {
    /* the vault list stays as stored */
  }
  try {
    const { loadIssued } = await import("./issuer-book");
    for (const row of await loadIssued()) {
      if (row.family !== "security" || !row.liquid) continue;
      out.push({
        id: `security:${row.mint}`,
        family: "listed",
        symbol: row.symbol,
        name: row.name,
        chain: "Solana",
        mint: row.mint,
        venue: row.venue,
        signPath: "jupiter",
        status: "open",
        note: `Liquid pool about $${Math.round(row.liquidity).toLocaleString("en-US")}. The wallet signs.`,
      });
    }
  } catch {
    /* the security book stays as stored */
  }
  try {
    const markets = [
      ["Main", "https://api.kamino.finance/kamino-market/7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF/reserves/metrics"],
      ["xStocks", "https://api.kamino.finance/kamino-market/5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua/reserves/metrics"],
    ];
    for (const [market, url] of markets) {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const rows = (await res.json()) as { liquidityToken?: string; liquidityTokenMint?: string; supplyApy?: string; totalSupplyUsd?: string }[];
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!row.liquidityToken || !row.liquidityTokenMint) continue;
        const supply = Number(row.totalSupplyUsd) || 0;
        const apy = Number(row.supplyApy) || 0;
        out.push({
          id: `loan:kamino:${row.liquidityTokenMint}`,
          family: "loan",
          symbol: row.liquidityToken,
          name: `${row.liquidityToken} on Kamino ${market}`,
          chain: "Solana",
          mint: row.liquidityTokenMint,
          venue: "Kamino",
          signPath: "kamino",
          status: supply >= 1_000_000 ? "open" : "listed",
          note: `Supply ${(apy * 100).toFixed(2)}%. About $${Math.round(supply).toLocaleString("en-US")} supplied. A swap does not enter this reserve.`,
        });
      }
    }
  } catch {
    /* Kamino stays as stored */
  }
  try {
    const { driftMarkets } = await import("./drift-book");
    for (const row of driftMarkets()) {
      out.push({
        id: `perp:drift-${row.symbol.toLowerCase()}`,
        family: "perp",
        symbol: `${row.symbol}-PERP`,
        name: `${row.symbol} on Drift`,
        chain: "Solana",
        mint: "",
        venue: "Drift",
        signPath: row.symbol === "SOL" || row.symbol === "ETH" || row.symbol === "BTC" ? "drift" : "",
        status: "open",
        note: row.symbol === "SOL" || row.symbol === "ETH" || row.symbol === "BTC" ? "This desk can sign it." : "Listed on Drift. This desk does not sign it yet.",
      });
    }
  } catch {
    /* Drift stays as stored */
  }
  return out;
}

async function writeRows(sql: Sql, rows: Draft[]) {
  const size = 20;
  for (let i = 0; i < rows.length; i += size) {
    const part = rows.slice(i, i + size);
    const values: unknown[] = [];
    const tuples = part.map((row, n) => {
      const b = n * 10;
      values.push(row.id, row.family, row.symbol, row.name, row.chain, row.mint, row.venue, row.signPath, row.status, row.note);
      const slot = (k: number) => `$${b + k}`;
      return `(${slot(1)},${slot(2)},${slot(3)},${slot(4)},${slot(5)},${slot(6)},${slot(7)},${slot(8)},${slot(9)},${slot(10)},now())`;
    });
    await sql.query(
      `insert into offering (id, family, symbol, name, chain, mint, venue, sign_path, status, note, updated_at) values ${tuples.join(",")} on conflict (id) do nothing`,
      values,
    );
  }
}

export async function registerOfferings(extra: Draft[] = []): Promise<number> {
  const sql = await getSql();
  const seen = new Set<string>();
  const rows: Draft[] = [];
  for (const row of [...staticBook(), ...registeredMarkets(), ...extra]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  const have = await sql<{ id: string }>`select id from offering`;
  const known = new Set(have.map((row) => row.id));
  const fresh = rows.filter((row) => !known.has(row.id));
  await writeRows(sql, fresh);
  return known.size + fresh.length;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export const listOfferings = createServerFn({ method: "GET" }).handler(async () => {
  await registerOfferings(await liveExtras());
  try {
    const { loadRegistry } = await import("./registry");
    const live = await loadRegistry();
    const drafts: Draft[] = [];
    for (const row of live) {
      if (!row.symbol) continue;
      const family =
        row.family === "xstock" || row.family === "security" ? "listed"
        : row.family === "coin" ? "spot"
        : row.family === "name" ? "name"
        : row.family === "stake" ? "stake"
        : row.family === "vault" ? "vault"
        : row.family === "perp" || row.family === "hl" ? "perp"
        : row.family === "ostium" ? "ostium"
        : row.family === "network" ? "chain"
        : "spot";
      drafts.push({
        id: `reg:${row.id}`.slice(0, 160),
        family,
        symbol: row.symbol.slice(0, 32),
        name: (row.name || row.symbol).slice(0, 80),
        chain: row.chain,
        mint: row.mint || "",
        venue: row.venue.slice(0, 48),
        signPath: row.sign,
        status: "open",
        note: row.note.slice(0, 180),
      });
    }
    await registerOfferings(drafts);
  } catch {
    /* the live venues stay on their own pages if this pass fails */
  }
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
    if (data.status != null) await sql`update offering set status = ${data.status}, updated_at = now() where id = ${data.id}`;
    if (data.note != null) await sql`update offering set note = ${data.note}, updated_at = now() where id = ${data.id}`;
    return { id: data.id };
  });
