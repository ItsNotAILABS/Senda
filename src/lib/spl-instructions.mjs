/**
 * Byte-level SPL Token / Associated Token Account instruction data and Solana wire helpers.
 * Kept dependency-free so it can be unit-tested without a bundler.
 */
const TRANSFER_CHECKED = 12;
const ATA_CREATE_IDEMPOTENT = 1;
const U64_MAX = (1n << 64n) - 1n;

/** SPL Token TransferChecked: [12, amount u64 LE, decimals u8]. Validates mint decimals on-chain. */
export function transferCheckedData(amountRaw, decimals) {
  if (typeof amountRaw !== "bigint" || amountRaw <= 0n || amountRaw > U64_MAX) throw new Error("Invalid token amount.");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error("Invalid token decimals.");
  const data = new Uint8Array(10);
  data[0] = TRANSFER_CHECKED;
  new DataView(data.buffer).setBigUint64(1, amountRaw, true);
  data[9] = decimals;
  return data;
}

/** Associated Token Account CreateIdempotent: succeeds when the account already exists. */
export function ataCreateIdempotentData() {
  return Uint8Array.of(ATA_CREATE_IDEMPOTENT);
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Encode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}

/**
 * The transaction id of a signed wire transaction is its first signature.
 * Reading it before broadcast lets Senda journal the exact signature that will land.
 */
export function firstSignatureFromWire(wire) {
  if (!(wire instanceof Uint8Array) || wire.length < 65) throw new Error("Signed transaction is malformed.");
  // compact-u16 signature count
  let count = 0, shift = 0, offset = 0;
  for (;;) {
    if (offset >= 3) throw new Error("Signed transaction is malformed.");
    const byte = wire[offset++];
    count |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) break;
    shift += 7;
  }
  if (count < 1 || wire.length < offset + 64) throw new Error("Signed transaction has no signature.");
  const sig = wire.subarray(offset, offset + 64);
  if (sig.every((b) => b === 0)) throw new Error("Wallet returned an unsigned transaction.");
  return base58Encode(sig);
}
