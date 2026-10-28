/** Sign a Mayan quote. The fee address is the Solana referrer. A failed Swift refunds to the signer. */

import { Connection } from "@solana/web3.js";
import { MAYAN_FEE_ADDRESS, MAYAN_FEE_BPS, type Json } from "@/lib/mayan-quote";

type PhantomSol = {
  connect: () => Promise<{ publicKey?: { toString(): string } }>;
  publicKey?: { toString(): string };
  signTransaction: (tx: unknown) => Promise<unknown>;
};

function phantom(): PhantomSol {
  const w = window as unknown as { phantom?: { solana?: PhantomSol } };
  const sol = w.phantom?.solana;
  if (!sol) throw new Error("Open this page in Phantom. Solana USDC is what this rail sends.");
  return sol;
}

function num(v: Json | undefined): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export async function signMayan(quote: Json, owner: string, destination: string, quotedAt: number): Promise<string> {
  if (!quote || typeof quote !== "object" || Array.isArray(quote)) throw new Error("The quote is missing.");
  if (num(quote.referrerBps) !== MAYAN_FEE_BPS) throw new Error("This quote is not priced with the Senda fee.");
  if (Date.now() - quotedAt > 30_000) throw new Error("That quote is stale. Wait for the next one.");
  if (/^0x0{40}$/i.test(destination)) throw new Error("That address is empty. Hyperliquid needs your 0x, not the token id.");
  const sol = phantom();
  const connected = await sol.connect();
  const who = connected?.publicKey?.toString() || sol.publicKey?.toString() || "";
  if (!who || who !== owner) throw new Error("Phantom is a different Solana account than the one on this rail.");
  const { swapFromSolana } = await import("@mayanfinance/swap-sdk");
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const done = (await swapFromSolana(
    quote as never,
    owner,
    destination,
    { solana: MAYAN_FEE_ADDRESS },
    ((tx: never) => sol.signTransaction(tx)) as never,
    connection as never,
    undefined,
    undefined,
    undefined,
    { swiftRefundAddress: owner },
  )) as { signature?: string };
  if (!done?.signature) throw new Error("Mayan did not return a signature.");
  return done.signature;
}
