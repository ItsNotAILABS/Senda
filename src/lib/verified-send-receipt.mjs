/**
 * Display a USDC receipt only from the exact confirmed wallet-scoped journal row.
 * Quote/form state may have changed while an uncertain transfer was awaiting finality.
 * This is a UI provenance guard, not an independent on-chain settlement verifier.
 */
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
const RAW = /^[1-9][0-9]*$/;

export function verifiedSendReceipt({ owner, signature, rows } = {}) {
  if (!ADDRESS.test(owner || "") || !SIGNATURE.test(signature || "") || !Array.isArray(rows))
    throw Error("CONFIRMED_TRANSFER_EVIDENCE_MISSING");
  const matches = rows.filter(row => row && row.owner === owner &&
    row.signature === signature && row.kind === "send" && row.asset === "USDC");
  if (matches.length !== 1) throw Error("CONFIRMED_TRANSFER_EVIDENCE_MISSING");
  const row = matches[0];
  if (!["confirmed", "finalized"].includes(row.status) ||
      !ADDRESS.test(row.destination || "") || !RAW.test(row.amountRaw || ""))
    throw Error("CONFIRMED_TRANSFER_EVIDENCE_INVALID");
  const raw = BigInt(row.amountRaw);
  // 6-decimal USDC; cents must be exact. Never round a receipt's amount.
  if (raw % 10000n !== 0n) throw Error("UNSUPPORTED_RECEIPT_PRECISION");
  const centsBig = raw / 10000n;
  if (centsBig <= 0n || centsBig > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("INVALID_RECEIPT_AMOUNT");
  return Object.freeze({ signature, cents: Number(centsBig), to: row.destination });
}
