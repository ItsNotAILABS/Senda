/** Broadcast a LI.FI Solana transaction. The wallet signs. Senda does not hold the key. */

import { sendVersioned } from "@/lib/phantom";

export async function sendLifiSolana(b64: string): Promise<string> {
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const raw = Buffer.from(b64, "base64");
  if (raw.length < 64) throw new Error("LI.FI did not return a Solana transaction.");
  const { VersionedTransaction, Transaction } = await import("@solana/web3.js");
  let tx: { serialize: () => Uint8Array };
  try {
    tx = VersionedTransaction.deserialize(raw);
  } catch {
    tx = Transaction.from(raw);
  }
  return sendVersioned(tx);
}
