/** x402 v2, Solana exact scheme. This builds the requirement. It does not settle, and it does not run a facilitator. */

import { PublicKey } from "@solana/web3.js";

export const X402_VERSION = 2;
export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type ExactRequirement = {
  scheme: "exact";
  network: typeof SOLANA_MAINNET;
  amount: string;
  asset: typeof USDC_MAINNET;
  payTo: string;
  maxTimeoutSeconds: 60;
  extra: { name: "USDC"; decimals: 6 };
};

export type PaymentRequired = {
  x402Version: 2;
  resource: { url: string; description: string; mimeType: "application/json" };
  accepts: [ExactRequirement];
};

/** One payee, one cent-priced USDC amount, Solana mainnet. `upto` and batch are not offered. */
export function exactRequirement(input: {
  payTo: string;
  usd: number;
  description: string;
  url: string;
}): PaymentRequired | { error: string } {
  let payTo = "";
  try {
    payTo = new PublicKey(input.payTo.trim()).toBase58();
  } catch {
    return { error: "The payee is not a Solana address." };
  }
  if (!Number.isFinite(input.usd) || input.usd < 0.01 || input.usd > 100) return { error: "An exact ticket is $0.01 to $100." };
  const cents = Math.round(input.usd * 100);
  if (Math.abs(cents - input.usd * 100) > 0.01) return { error: "Price the ticket in cents." };
  const description = input.description.replace(/\s+/g, " ").trim();
  if (description.length < 2 || description.length > 80) return { error: "Name the resource." };
  const url = input.url.trim();
  if (!url.startsWith("/") || url.includes(" ")) return { error: "The resource path has to start with /." };
  return {
    x402Version: X402_VERSION,
    resource: { url, description, mimeType: "application/json" },
    accepts: [
      {
        scheme: "exact",
        network: SOLANA_MAINNET,
        amount: String(cents * 10_000),
        asset: USDC_MAINNET,
        payTo,
        maxTimeoutSeconds: 60,
        extra: { name: "USDC", decimals: 6 },
      },
    ],
  };
}
