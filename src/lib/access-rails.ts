/** What Senda can prove, and the rails announced around it that this desk will not fake. */

export const JUPITER_LANES = [
  {
    id: "identity",
    name: "Verified identity",
    there: "Live at Jupiter",
    here: "Not called. The only identity kept here is this phone’s key, and it does not leave the device.",
  },
  {
    id: "credit",
    name: "On-chain credit score",
    there: "Coming soon",
    here: "Not issued. The plan and the send cap are limits you set. They are not a score.",
  },
  {
    id: "wealth",
    name: "Proof of wealth",
    there: "Coming soon",
    here: "Not a zero-knowledge proof. A connected wallet can show its public USDC, or a band instead of the number.",
  },
] as const;

export const ISSUER_ASKS = [
  {
    id: "design",
    name: "Design",
    line: "Jupiter Liquidity Services designs a token with an issuer. This desk does not file that request.",
  },
  {
    id: "seed",
    name: "Seed",
    line: "Seed capital sits on their desk. This page will not move a treasury.",
  },
  {
    id: "mm",
    name: "Market makers",
    line: "Maker introductions stay with Jupiter. There is no maker button here.",
  },
  {
    id: "ultra",
    name: "Routing",
    line: "A name is listed here only after a $25 Jupiter buy clears inside 1% impact. The quote does not sign.",
  },
] as const;

/** Jupiter Lend × Bullish, announced 16 Nov 2026. The market is not open. */
export const BULLISH = {
  open: false,
  status: "Announced",
  when: "16 Nov 2026",
  where: "Breakpoint, London",
  market: "Jupiter Lend",
  asset: "BLSH Issuer Tokens",
  shape: "The share itself. Not a wrapper.",
  gate: "Permissioned. A whitelist and a jurisdiction check. Not open.",
  terms: "No public loan terms, so this desk will not invent a rate or a borrow.",
  agent: "Bullish acquired Equiniti, a transfer agent. Senda is not that agent.",
} as const;

export function holdingBand(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "No USDC in this wallet";
  if (usd < 100) return "Under $100";
  if (usd < 1_000) return "$100 to $1,000";
  if (usd < 10_000) return "$1,000 to $10,000";
  return "Over $10,000";
}

export function shareCard(input: {
  device: "open" | "sealed" | "none";
  wallet: string;
  usdc: number | null;
  bandOnly: boolean;
  floor: number;
  sendLeft: number;
}): string {
  const who = input.wallet.length >= 8 ? `${input.wallet.slice(0, 4)}…${input.wallet.slice(-4)}` : "No wallet";
  const hold =
    input.usdc == null ? "USDC not read" : input.bandOnly ? holdingBand(input.usdc) : `$${input.usdc.toFixed(2)} public USDC`;
  const device = input.device === "open" ? "Phone key open" : input.device === "sealed" ? "Phone key sealed" : "No phone key";
  return [
    "Senda passport",
    device,
    `Wallet ${who}`,
    hold,
    `Cash floor $${input.floor.toFixed(2)}`,
    `Send room $${input.sendLeft.toFixed(2)} this month`,
    "This is not Jupiter Verified Identity. No document was stored. This is not a credit score. This is not a zero-knowledge proof of wealth.",
  ].join("\n");
}
