/**
 * Shared pools. A pool is an account on a program Jupiter already routes.
 * Senda does not run a second book.
 */

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** Programs a new one-sided pool can be opened on. Jupiter already routes both. */
export const OPEN_PROGRAMS = [
  {
    id: "meteora-dlmm",
    label: "Meteora DLMM",
    programId: "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
    shape: "One-sided position. The whole supply sits above the open. Buyers pay the quote in.",
  },
  {
    id: "orca-whirlpool",
    label: "Orca Whirlpool",
    programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
    shape: "Concentrated range. Same idea: the position starts one-sided and the LP is burned.",
  },
] as const;

export type OpenProgramId = (typeof OPEN_PROGRAMS)[number]["id"];

const PROGRAM_BY_LABEL: Record<string, string> = {
  "Meteora DLMM": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  Whirlpool: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
};

export function programForLabel(label: string): string | null {
  return PROGRAM_BY_LABEL[label] ?? null;
}

export type SharedHop = {
  label: string;
  pool: string;
  percent: number;
  inMint: string;
  outMint: string;
  programId: string | null;
};

export type SharedBook = {
  symbol: string;
  name: string;
  mint: string;
  last: number;
  usd: number;
  hops: SharedHop[];
  outAmount: string | null;
  impact: string | null;
  error?: string;
};

export type QuoteLeg =
  | { kind: "usdc"; symbol: "USDC"; mint: string }
  | { kind: "prestocks"; symbol: string; mint: string };

export type LaunchSpec = {
  name: string;
  symbol: string;
  supply: 1_000_000_000;
  decimals: 6;
  feeBps: 100;
  lock: "burn";
  programId: OpenProgramId;
  quotes: QuoteLeg[];
};

export type LaunchStep = {
  n: number;
  op: string;
  detail: string;
};

export type LaunchPlan = {
  spec: LaunchSpec;
  programLabel: string;
  programAccount: string;
  steps: LaunchStep[];
  line: string;
};

export function openProgram(id: OpenProgramId) {
  const found = OPEN_PROGRAMS.find((p) => p.id === id);
  if (!found) throw new Error("Unknown pool program.");
  return found;
}

export function buildLaunchPlan(spec: LaunchSpec): LaunchPlan {
  const program = openProgram(spec.programId);
  const ticker = spec.symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "TOKEN";
  const quotes = spec.quotes.length ? spec.quotes : [{ kind: "usdc" as const, symbol: "USDC" as const, mint: USDC_MINT }];
  const steps: LaunchStep[] = [
    {
      n: 1,
      op: "Create the mint",
      detail: `${ticker} · supply ${spec.supply.toLocaleString("en-US")} · ${spec.decimals} decimals · mint authority is the connected wallet.`,
    },
  ];
  quotes.forEach((q, i) => {
    steps.push({
      n: steps.length + 1,
      op: `Open pool ${i + 1} on ${program.label}`,
      detail: `Quote ${q.symbol} ${q.mint}. Base is the new mint. One-sided. Fee ${(spec.feeBps / 100).toFixed(1)}%. Program ${program.programId}.`,
    });
  });
  steps.push({
    n: steps.length + 1,
    op: "Burn the position",
    detail: "The LP leaves the wallet in the same transaction. The creator cannot pull the pool. Senda never holds the mint.",
  });
  const quoteNames = quotes.map((q) => q.symbol).join(" and ");
  return {
    spec: { ...spec, symbol: ticker, quotes },
    programLabel: program.label,
    programAccount: program.programId,
    steps,
    line: `${ticker} against ${quoteNames}, on ${program.label}. No pool exists until the wallet signs this. After it lands, it is a normal pool Jupiter can route.`,
  };
}
