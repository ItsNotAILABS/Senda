/** Passphrase box. PBKDF2-SHA256, 250,000 rounds, then AES-GCM-256. The passphrase is never stored. */

const ITER = 250_000;

export type PrivateBox = {
  salt: string;
  iv: string;
  box: string;
};

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function passKey(passphrase: string, salt: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export async function sealBytes(plain: Uint8Array, passphrase: string): Promise<PrivateBox> {
  if (passphrase.length < 8) throw new Error("Use at least 8 characters. It is not stored.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passKey(passphrase, salt, ["encrypt"]);
  const boxed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  return { salt: b64(salt), iv: b64(iv), box: b64(boxed) };
}

export async function openBytes(row: PrivateBox, passphrase: string): Promise<Uint8Array> {
  if (passphrase.length < 8) throw new Error("That passphrase is too short.");
  const key = await passKey(passphrase, unb64(row.salt), ["decrypt"]);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(row.iv) }, key, unb64(row.box)));
  } catch {
    throw new Error("That passphrase did not open this.");
  }
}

export async function sealText(plain: string, passphrase: string): Promise<PrivateBox> {
  return sealBytes(new TextEncoder().encode(plain), passphrase);
}

export async function openText(row: PrivateBox, passphrase: string): Promise<string> {
  const bytes = await openBytes(row, passphrase);
  try {
    return new TextDecoder().decode(bytes);
  } finally {
    bytes.fill(0);
  }
}
