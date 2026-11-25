/**
 * Solana Pay transfer-request links with a unique `reference` key, and verification that a
 * transaction found by that reference actually paid the requested USDC to the requester.
 */
import { centsToDecimalString, centsToUsdcRaw } from "./usdc-amount.mjs";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function buildUsdcPayLink({ to, cents, memo = "", reference, mint }) {
  const recipient = String(to ?? "").trim();
  if (!ADDRESS.test(recipient)) throw new Error("Connect a receiving wallet first.");
  if (!ADDRESS.test(String(mint ?? ""))) throw new Error("Unknown token mint.");
  if (reference != null && !ADDRESS.test(String(reference))) throw new Error("Invalid payment reference.");
  const q = new URLSearchParams({ amount: centsToDecimalString(cents), "spl-token": mint });
  if (reference) q.set("reference", reference);
  const cleanMemo = String(memo ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
  if (cleanMemo) q.set("memo", cleanMemo);
  return `solana:${recipient}?${q.toString()}`;
}

/**
 * @param {any} tx getTransaction(..., {encoding:"jsonParsed"}) result
 * @returns {{paid:boolean, reason:string}}
 */
export function verifyReferencedUsdcPayment(tx, { recipient, mint, cents }) {
  if (!tx || typeof tx !== "object" || !tx.meta) return { paid: false, reason: "Transaction not found yet." };
  if (tx.meta.err != null) return { paid: false, reason: "The referenced transaction failed on-chain." };
  const expected = centsToUsdcRaw(cents);
  const sum = (rows) => (Array.isArray(rows) ? rows : [])
    .filter((b) => b && b.owner === recipient && b.mint === mint)
    .reduce((acc, b) => acc + BigInt(b.uiTokenAmount?.amount ?? "0"), 0n);
  const delta = sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances);
  if (delta === expected) return { paid: true, reason: "Paid in full." };
  if (delta <= 0n) return { paid: false, reason: "That transaction did not pay this wallet in USDC." };
  return { paid: false, reason: `Amount mismatch: received ${delta} base units, expected ${expected}.` };
}
