/**
 * Paper Meteora DBC — PreStocks / Tessera names before they graduate to Jupiter.
 * Constant-product virtual curve. Target is USDC raised, then the book is the AMM.
 */

export type CurveRow = {
  id: string;
  symbol: string;
  name: string;
  venue: "prestocks" | "tessera";
  mint: string;
  raised: number;
  target: number;
  supply: number;
  virt: number;
  price: number;
};

export type CurveBag = Record<string, number>;

const KEY = "senda.curve.v1";

const SEED: CurveRow[] = [
  {
    id: "cv-openai",
    symbol: "OPENAI",
    name: "OpenAI",
    venue: "prestocks",
    mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
    raised: 18600,
    target: 50000,
    supply: 820_000,
    virt: 42_000,
    price: 0,
  },
  {
    id: "cv-kalshi",
    symbol: "KALSHI",
    name: "Kalshi",
    venue: "prestocks",
    mint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
    raised: 4100,
    target: 50000,
    supply: 240_000,
    virt: 48_000,
    price: 0,
  },
  {
    id: "cv-spacex",
    symbol: "SPACEX",
    name: "SpaceX",
    venue: "tessera",
    mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    raised: 39200,
    target: 50000,
    supply: 1_140_000,
    virt: 28_000,
    price: 0,
  },
];

function withPrice(c: CurveRow): CurveRow {
  const price = c.supply > 0 ? c.virt / c.supply : 0;
  return { ...c, price };
}

export function loadCurves(): CurveRow[] {
  if (typeof window === "undefined") return SEED.map(withPrice);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return SEED.map(withPrice);
    const p = JSON.parse(raw) as { rows?: CurveRow[]; bag?: CurveBag };
    if (!Array.isArray(p.rows) || p.rows.length === 0) return SEED.map(withPrice);
    return p.rows.map(withPrice);
  } catch {
    return SEED.map(withPrice);
  }
}

export function loadBag(): CurveBag {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as { bag?: CurveBag };
    return p.bag && typeof p.bag === "object" ? p.bag : {};
  } catch {
    return {};
  }
}

function persist(rows: CurveRow[], bag: CurveBag): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ rows, bag }));
  } catch {
    /* quota */
  }
}

export function pctGrad(c: CurveRow): number {
  if (!(c.target > 0)) return 0;
  return Math.min(1, c.raised / c.target);
}

export function buyCurve(
  rows: CurveRow[],
  bag: CurveBag,
  id: string,
  usd: number,
): { rows: CurveRow[]; bag: CurveBag; tokens: number; error?: string } {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return { rows, bag, tokens: 0, error: "Curve not found." };
  if (!(usd > 0)) return { rows, bag, tokens: 0, error: "Enter an amount." };
  const c = rows[i];
  const k = c.virt * c.supply;
  const virt2 = c.virt + usd;
  const supply2 = k / virt2;
  const tokens = c.supply - supply2;
  const next = rows.slice();
  next[i] = withPrice({
    ...c,
    virt: virt2,
    supply: supply2,
    raised: c.raised + usd,
  });
  const nextBag = { ...bag, [id]: (bag[id] ?? 0) + tokens };
  persist(next, nextBag);
  return { rows: next, bag: nextBag, tokens };
}

export function sellCurve(
  rows: CurveRow[],
  bag: CurveBag,
  id: string,
  tokens: number,
): { rows: CurveRow[]; bag: CurveBag; usd: number; error?: string } {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return { rows, bag, usd: 0, error: "Curve not found." };
  const held = bag[id] ?? 0;
  if (!(tokens > 0) || tokens > held + 1e-9) return { rows, bag, usd: 0, error: "Not enough tokens." };
  const c = rows[i];
  const k = c.virt * c.supply;
  const supply2 = c.supply + tokens;
  const virt2 = k / supply2;
  const usd = c.virt - virt2;
  const next = rows.slice();
  next[i] = withPrice({
    ...c,
    virt: virt2,
    supply: supply2,
    raised: Math.max(0, c.raised - usd),
  });
  const nextBag = { ...bag, [id]: held - tokens };
  persist(next, nextBag);
  return { rows: next, bag: nextBag, usd };
}
