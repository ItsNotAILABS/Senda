/** Sign a Mayan quote from Solana. No referrer address is passed. */

import { Connection } from "@solana/web3.js";
import type { Json } from "@/lib/mayan-quote";

type PhantomSol = {
  connect: () => Promise<unknown>;
  signTransaction: (tx: unknown) => Promise<unknown>;
};

function phantom(): PhantomSol {
  const w = window as unknown as { phantom?: { solana?: PhantomSol } };
  const sol = w.phantom?.solana;
  if (!sol) throw new Error("Open this page in Phantom. Solana USDC is what this rail sends.");
  return sol;
}

export async function signMayan(quote: Json, owner: string, destination: string): Promise<string> {
  const { swapFromSolana } = await import("@mayanfinance/swap-sdk");
  const sol = phantom();
  await sol.connect();
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const done = (await swapFromSolana(
    quote as never,
    owner,
    destination,
    null,
    ((tx: never) => sol.signTransaction(tx)) as never,
    connection as never,
  )) as { signature?: string };
  if (!done?.signature) throw new Error("Mayan did not return a signature.");
  return done.signature;
}
