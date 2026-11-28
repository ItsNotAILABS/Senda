/** What a send will cost before the wallet is asked. The signature fee is the base. Rent is checked on the chain. */

import { PublicKey } from "@solana/web3.js";
import { sendCut } from "@/lib/desk-fee";
import { chainRpc } from "@/lib/phantom";

const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const RENT = 0.00203928;

export type SendPreview = {
  cut: string;
  network: string;
  account: string;
  oneTime: boolean;
};

export async function previewSend(to: string, kind: "sol" | "usdc" | "token", usd: number, mint?: string): Promise<SendPreview> {
  const cut = kind === "usdc" ? sendCut(usd).why : "No USDC desk cut on this asset. They receive what you enter.";
  let network = "Base signature is 0.000005 SOL. The wallet shows the exact fee, including any priority, when you sign.";
  try {
    const fees = (await chainRpc("getRecentPrioritizationFees", [])) as Array<{ prioritizationFee?: number }>;
    const nums = (fees || []).map((row) => Number(row.prioritizationFee) || 0).filter((n) => n > 0).sort((a, b) => a - b);
    const mid = nums.length ? nums[Math.floor(nums.length / 2)] : 0;
    if (mid > 0) network = `Base signature is 0.000005 SOL. A recent priority sample is ${mid.toLocaleString("en-US")} microlamports per compute unit. The wallet sets the exact fee.`;
  } catch {
    /* the base line stays */
  }
  if (kind === "sol") return { cut, network, account: "SOL needs no token account.", oneTime: false };
  const tokenMint = kind === "usdc" ? USDC : new PublicKey(mint || "");
  const ata = PublicKey.findProgramAddressSync([new PublicKey(to).toBytes(), TOKEN.toBytes(), tokenMint.toBytes()], ATA)[0];
  const info = (await chainRpc("getAccountInfo", [ata.toBase58(), { encoding: "base64" }]).catch(() => null)) as { value?: unknown } | null;
  const exists = Boolean(info?.value);
  return {
    cut,
    network,
    account: exists
      ? "They already hold this token. No account rent."
      : `One-time. Opening their token account is about ${RENT} SOL. The next send of this token skips it.`,
    oneTime: !exists,
  };
}
