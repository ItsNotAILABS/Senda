/** A Parallax check that can only talk about devnet. It does not import the mainnet spend cap and it never signs. */

export const PARALLAX_CLUSTER = "devnet" as const;
export const PARALLAX_RPC = "https://api.devnet.solana.com";

export function checkParallaxDevnet(input: {
  cluster: string;
  usd: number;
  impact: number;
  budget: number;
}): { ok: boolean; why: string } {
  if (input.cluster !== PARALLAX_CLUSTER) {
    return { ok: false, why: "This Parallax control is devnet only. It will not clear a mainnet order." };
  }
  const usd = input.usd;
  const impact = input.impact;
  const budget = input.budget;
  if (!Number.isFinite(usd) || !(usd > 0)) return { ok: false, why: "The size is not a usable dollar amount. Nothing was sent." };
  if (!Number.isFinite(impact) || impact < 0) return { ok: false, why: "Impact is not a number. Nothing was sent." };
  if (impact > 1) return { ok: false, why: `Impact is ${impact.toFixed(2)}%, above 1%. Nothing was sent.` };
  if (!Number.isFinite(budget) || usd > budget) {
    return { ok: false, why: `That is $${usd.toFixed(2)}, above the $${Number.isFinite(budget) ? budget.toFixed(2) : "0.00"} devnet budget. Nothing was sent.` };
  }
  return {
    ok: true,
    why: `Devnet only. $${usd.toFixed(2)} is inside the $${budget.toFixed(2)} budget at ${impact.toFixed(2)}% impact. This check does not sign and does not move mainnet USDC.`,
  };
}

/** Agent spending stays closed until the program account exists and byte 10 is open. */
export function agentSpendGate(input: { verified: boolean; spendOpen: boolean }): { ok: true } | { ok: false; why: string } {
  if (!input.verified) {
    return { ok: false, why: "Agent spending is off. No Parallax devnet treasury has been verified. Nothing was sent." };
  }
  if (!input.spendOpen) {
    return { ok: false, why: "The treasury can be funded. Draw is closed on the program. Nothing was sent." };
  }
  return { ok: true };
}
