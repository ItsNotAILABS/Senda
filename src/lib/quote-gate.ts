/** A name is listed only after Jupiter quotes a $25 buy inside 1% impact. */

import { createServerFn } from "@tanstack/react-start";
import { fetchQuote, impactPct } from "@/lib/jup-exec";
import { listSolanaXStocks } from "@/lib/equities";
import { PRESTOCK_MINTS } from "@/lib/phantom";

const KAMINO = "https://api.kamino.finance/kamino-market/5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua/reserves/metrics";
const RETAIL_USD = 25;
const MAX_IMPACT = 1;
const MAX_XSTOCKS = 28;
const TTL_MS = 4 * 60 * 1000;

/** Search order only. A name still has to quote before it is listed. */
const PRIORITY = [
  "SPYx", "QQQx", "TSLAx", "NVDAx", "AAPLx", "MSFTx", "AMZNx", "GOOGLx", "METAx", "AMDx",
  "COINx", "NFLXx", "AVGOx", "HOODx", "CRCLx", "INTCx", "ORCLx", "PLTRx", "MSTRx", "JPMx",
  "Vx", "WMTx", "KOx", "PEPx", "XOMx", "JNJx", "UNHx", "TSMx", "IBMx", "CVXx",
  "LLYx", "CRMx", "PGx", "MUx", "ASMLx", "UBERx", "DISx", "GSEx", "BACx", "CMCSAx",
];

export type VerifiedAsset = {
  kind: "prestock" | "xstock";
  symbol: string;
  name: string;
  mint: string;
  impactPct: number;
  route: string;
  outAmount: string;
  usd: number;
};

export type VerifiedBook = {
  assets: VerifiedAsset[];
  tried: number;
  at: number;
  note: string;
};

let cache: VerifiedBook | null = null;
let pending: Promise<VerifiedBook> | null = null;

async function quoteMint(kind: VerifiedAsset["kind"], symbol: string, name: string, mint: string): Promise<VerifiedAsset | "retry" | null> {
  const q = await fetchQuote(mint, RETAIL_USD, "buy");
  if ("error" in q) return /busy|429/i.test(q.error) ? "retry" : null;
  const impact = impactPct(q);
  if (!(impact <= MAX_IMPACT)) return null;
  return {
    kind,
    symbol,
    name,
    mint,
    impactPct: impact,
    route: q.route.join(" → ") || "Jupiter",
    outAmount: q.outAmount,
    usd: RETAIL_USD,
  };
}

type Candidate = { symbol: string; name: string; mint: string };

async function priorityCandidates(): Promise<Candidate[]> {
  const byMint = new Map<string, Candidate>();
  try {
    const listed = await listSolanaXStocks();
    const want = new Set(PRIORITY);
    for (const row of listed) {
      if (!want.has(row.symbol) || row.halted) continue;
      byMint.set(row.mint, { symbol: row.symbol, name: row.name, mint: row.mint });
    }
  } catch {
    /* The quote list can still use Kamino. */
  }
  try {
    const res = await fetch(KAMINO, { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
    if (res.ok) {
      const metrics = (await res.json()) as Array<{ liquidityToken?: string; liquidityTokenMint?: string }>;
      for (const row of metrics) {
        const symbol = row.liquidityToken || "";
        const mint = row.liquidityTokenMint || "";
        if (!symbol.endsWith("x") || mint.length < 32 || byMint.has(mint)) continue;
        if (!PRIORITY.includes(symbol)) continue;
        byMint.set(mint, { symbol, name: symbol, mint });
      }
    }
  } catch {
    /* Kamino is only a hint. The quote still decides. */
  }
  return [...byMint.values()].sort((a, b) => {
    const ai = PRIORITY.indexOf(a.symbol);
    const bi = PRIORITY.indexOf(b.symbol);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

async function build(): Promise<VerifiedBook> {
  const assets: VerifiedAsset[] = [];
  const seen = new Set<string>();
  let tried = 0;
  const deadline = Date.now() + 45_000;
  const prePromise = Promise.all(
    PRESTOCK_MINTS.map(async ([symbol, mint]) => {
      tried += 1;
      seen.add(mint);
      const row = await quoteMint("prestock", symbol, symbol, mint);
      return row === "retry" ? null : row;
    }),
  );
  const candidates = await priorityCandidates();
  const pre = await prePromise;
  for (const row of pre) if (row) assets.push(row);

  const retry: Candidate[] = [];
  for (let i = 0; i < candidates.length && assets.filter((a) => a.kind === "xstock").length < MAX_XSTOCKS && Date.now() < deadline; i += 4) {
    const slice = candidates.slice(i, i + 4).filter((c) => !seen.has(c.mint));
    for (const c of slice) seen.add(c.mint);
    tried += slice.length;
    const quoted = await Promise.all(slice.map((c) => quoteMint("xstock", c.symbol, c.name, c.mint)));
    quoted.forEach((row, idx) => {
      const item = slice[idx];
      if (row === "retry" && item) retry.push(item);
      else if (row && row !== "retry" && assets.filter((a) => a.kind === "xstock").length < MAX_XSTOCKS) assets.push(row);
    });
  }
  for (let pass = 0; pass < 2 && retry.length && assets.filter((a) => a.kind === "xstock").length < MAX_XSTOCKS && Date.now() < deadline; pass += 1) {
    await new Promise((r) => setTimeout(r, 700));
    const pending = retry.splice(0, retry.length);
    for (let i = 0; i < pending.length && assets.filter((a) => a.kind === "xstock").length < MAX_XSTOCKS; i += 2) {
      const slice = pending.slice(i, i + 2);
      tried += slice.length;
      const quoted = await Promise.all(slice.map((c) => quoteMint("xstock", c.symbol, c.name, c.mint)));
      quoted.forEach((row, idx) => {
        const item = slice[idx];
        if (row === "retry" && item) retry.push(item);
        else if (row && row !== "retry" && assets.filter((a) => a.kind === "xstock").length < MAX_XSTOCKS) assets.push(row);
      });
    }
  }

  const xCount = assets.filter((a) => a.kind === "xstock").length;
  const note =
    xCount > 0
      ? `${xCount} xStocks and ${assets.length - xCount} pre-IPO names quoted at $${RETAIL_USD} inside ${MAX_IMPACT}% impact. Anything Jupiter would not fill is not listed.`
      : assets.length
        ? `Pre-IPO names that filled at $${RETAIL_USD} are listed. No xStock quoted inside ${MAX_IMPACT}% before the clock.`
        : `Jupiter did not fill a $${RETAIL_USD} buy inside ${MAX_IMPACT}% impact. Nothing is listed.`;
  const book: VerifiedBook = { assets, tried, at: Date.now(), note };
  cache = book;
  return book;
}

export function loadVerified(): Promise<VerifiedBook> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache);
  if (!pending) {
    pending = build().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export const getVerifiedAssets = createServerFn({ method: "GET" }).handler(async () => loadVerified());
