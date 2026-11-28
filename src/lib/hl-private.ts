/** Pre-IPO perps on Hyperliquid. A share price and a valuation are different books. */

export type PrivateUnit = "share" | "valuation";

export type PrivateBook = {
  id: string;
  name: string;
  unit: PrivateUnit;
  line: string;
};

const BOOKS: PrivateBook[] = [
  {
    id: "xyz:ANT",
    name: "Anthropic",
    unit: "share",
    line: "One point is the anticipated price of one share. It is not a share, and it is not the company.",
  },
  {
    id: "para:ANTH",
    name: "Anthropic",
    unit: "share",
    line: "One point is an expected share price, on a different book from the valuation perp.",
  },
  {
    id: "xyz:SHEIN",
    name: "Shein",
    unit: "share",
    line: "One point is a price. It is not a share of the company.",
  },
  {
    id: "io:ANTH",
    name: "Anthropic",
    unit: "valuation",
    line: "One point is $1 billion of implied valuation. 1,700 means $1.7 trillion. It is not a share price.",
  },
  {
    id: "io:OAI",
    name: "OpenAI",
    unit: "valuation",
    line: "One point is $1 billion of implied valuation. It is not a share.",
  },
  {
    id: "vntl:ANTHROPIC",
    name: "Anthropic",
    unit: "valuation",
    line: "One point is $1 billion of implied valuation. If the day's volume is zero, a market order may not fill.",
  },
  {
    id: "vntl:OPENAI",
    name: "OpenAI",
    unit: "valuation",
    line: "One point is $1 billion of implied valuation. If the day's volume is zero, a market order may not fill.",
  },
  {
    id: "vntl:SPACEX",
    name: "SpaceX",
    unit: "valuation",
    line: "One point is $1 billion of implied valuation. If the day's volume is zero, a market order may not fill.",
  },
  {
    id: "para:UNITREE",
    name: "Unitree",
    unit: "share",
    line: "One point is a price on this book. It is not a share of the company.",
  },
];

const BY_ID = new Map(BOOKS.map((row) => [row.id, row]));

export function privateBook(id: string): PrivateBook | null {
  return BY_ID.get(id) ?? null;
}

export function privateBooks(): readonly PrivateBook[] {
  return BOOKS;
}

export function dayChange(mark: number, prev: number, unit: PrivateUnit | "price"): { text: string; up: boolean } | null {
  if (!(mark > 0) || !(prev > 0) || !Number.isFinite(mark) || !Number.isFinite(prev)) return null;
  const diff = mark - prev;
  const up = diff >= 0;
  const abs = Math.abs(diff);
  if (abs === 0) return { up: true, text: "unchanged" };
  const sign = up ? "+" : "-";
  const pct = `${sign}${Math.abs((diff / prev) * 100).toFixed(2)}%`;
  if (unit === "valuation") {
    const implied = abs >= 1000 ? `$${(abs / 1000).toFixed(2)}T` : `$${abs >= 10 ? Math.round(abs) : abs.toFixed(1)}B`;
    const points = (abs >= 100 ? abs.toFixed(1) : abs.toFixed(2)).replace(/\.?0+$/, "");
    return { up, text: `${sign}${points} · ${implied} · ${pct}` };
  }
  const dollars = abs >= 1 ? abs.toFixed(abs >= 100 ? 2 : 3) : abs.toPrecision(3);
  return { up, text: `${sign}$${dollars} (${pct})` };
}

export function markText(mark: number, unit: PrivateUnit | "price"): string {
  if (!(mark > 0) || !Number.isFinite(mark)) return "—";
  if (unit === "valuation") return mark.toLocaleString("en-US", { maximumFractionDigits: mark >= 100 ? 1 : 2 });
  if (mark >= 1000) return `$${mark.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (mark >= 1) return `$${mark.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${mark.toPrecision(3)}`;
}

/** Valuation marks are in billions. 1,700 is $1.70 trillion. */
export function impliedValue(mark: number): string {
  if (!(mark > 0) || !Number.isFinite(mark)) return "";
  if (mark >= 1000) return `$${(mark / 1000).toFixed(2)}T implied`;
  return `$${Math.round(mark)}B implied`;
}

export type DayBar = { high: number; low: number; points: number[] };

/** Hourly candles. High and low are the day. Points are closes, in order. */
export function parseDay(rows: unknown): DayBar | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let high = 0;
  let low = Number.POSITIVE_INFINITY;
  const points: number[] = [];
  for (const row of rows) {
    const bar = row as { h?: string | number; l?: string | number; c?: string | number };
    const h = Number(bar.h);
    const l = Number(bar.l);
    const c = Number(bar.c);
    if (h > high) high = h;
    if (l > 0 && l < low) low = l;
    if (c > 0 && Number.isFinite(c)) points.push(c);
  }
  if (!(high > 0) || !(low < Number.POSITIVE_INFINITY) || low > high) return null;
  return { high, low, points };
}

export function parseDayRange(rows: unknown): { high: number; low: number } | null {
  const day = parseDay(rows);
  if (!day) return null;
  return { high: day.high, low: day.low };
}
