import { activeSolProvider } from "@/lib/wallets";
import { broadcastSigned, phantomProvider } from "@/lib/phantom";

/** The clearing account already signed. Phantom pays the fee and broadcasts. */
export async function signClearing(b64: string): Promise<string> {
  const { Buffer } = await import("buffer");
  const { Transaction } = await import("@solana/web3.js");
  const tx = Transaction.from(Buffer.from(b64, "base64"));
  const p = (activeSolProvider() as ReturnType<typeof phantomProvider>) ?? phantomProvider();
  if (!p?.signTransaction) throw new Error("Connect Phantom in this window. It has to sign the payout.");
  const signed = await p.signTransaction(tx);
  return broadcastSigned(signed);
}
