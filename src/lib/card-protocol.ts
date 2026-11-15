/**
 * Senda card protocol.
 * The card spends and receives on the wallet that holds it.
 * Settlement is a USDC signature. The number is not a Visa charge.
 */

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function cardMemo(last4: string, dir: "IN" | "OUT", product: string): string {
  const what = product.replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 28) || "senda";
  return `SENDA:CARD:${last4}:${dir}:${what}`.slice(0, 80);
}

/** Anyone can pay this card. The recipient is the wallet, not its token account. */
export function cardReceiveUri(owner: string, last4: string, usd?: number, reference?: string): string {
  const q = new URLSearchParams();
  q.set("spl-token", USDC_MINT);
  if (usd && usd > 0) q.set("amount", String(usd));
  if (reference) q.set("reference", reference);
  q.set("label", `Senda ${last4}`);
  q.set("message", "Pay this card");
  q.set("memo", cardMemo(last4, "IN", "receive"));
  return `solana:${owner}?${q.toString()}`;
}
