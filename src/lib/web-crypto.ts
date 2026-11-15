/** Same calls as expo-crypto on the web: SHA-256 and random bytes, via SubtleCrypto. */

export async function digestStringAsync(algorithm: "SHA-256", data: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Crypto is unavailable. Open this on https.");
  const buf = await subtle.digest(algorithm, new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getRandomBytes(byteCount: number): Uint8Array {
  if (byteCount < 1 || byteCount > 1024) throw new Error("Ask for 1 to 1024 bytes.");
  const out = new Uint8Array(byteCount);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/** Mastercard disbursement_reference. Letters and digits only. */
export function payoutReference(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = getRandomBytes(12);
  let out = "SD";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
