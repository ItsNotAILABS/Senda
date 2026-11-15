/** Advisor files. A spec is data. It does not sign, and it does not hold a key. */

export type AdvisorOwner = "shipped" | "you";
export type AdvisorMode = "book" | "wrap" | "day-worst" | "day-best";
export type AdvisorSide = "buy" | "sell";
export type AdvisorSplit = "equal" | "one";
export type AdvisorRank = "premium" | "change" | "liquidity";

export type AdvisorSpec = {
  id: string;
  owner: AdvisorOwner;
  version: number;
  title: string;
  line: string;
  mode: AdvisorMode;
  side: AdvisorSide;
  premiumMin: number | null;
  premiumMax: number | null;
  changeMin: number | null;
  changeMax: number | null;
  minLiquidity: number;
  take: number;
  split: AdvisorSplit;
  rank: AdvisorRank;
  source: string;
};

export type AdvisorOrder = {
  symbol: string;
  mint: string;
  side: AdvisorSide;
  premium: number;
  last: number;
  usd: number;
};

export type AdvisorRun = {
  id: string;
  title: string;
  line: string;
  orders: AdvisorOrder[];
  note: string;
};

export type AdvisorApp = {
  id: string;
  name: string;
  blurb: string;
  /** ship:* follows catalog updates. you:* stays on the file the user saved. */
  advisorId: string;
  at: string;
};

export type CatalogUpdate = {
  id: string;
  title: string;
  version: number;
  previous: number;
};
