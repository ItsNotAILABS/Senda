/** Equal-weight and PRE8-style PreStocks packs. Paper. */

export const PACKS = [
  { id: "pre8", name: "PRE8", symbols: ["OPENAI", "ANTHROPIC", "SPACEX", "ANDURIL", "KALSHI", "NEURALINK", "FIGUREAI", "POLYMARKET"] },
  { id: "ai", name: "Frontier AI", symbols: ["OPENAI", "ANTHROPIC"] },
  { id: "space", name: "Space + defense", symbols: ["SPACEX", "ANDURIL"] },
  { id: "pred", name: "Prediction", symbols: ["KALSHI", "POLYMARKET"] },
] as const;

export type PackId = (typeof PACKS)[number]["id"];
