/**
 * The wallet is the account. What the desk remembers is ciphertext.
 * The key lives in memory for this visit. It is the signature of one fixed line.
 * This file cannot open a note from another wallet, and it does not keep the signature.
 */

const MARK = "sen1.";
const EVENT = "senda-seal";

let aes: CryptoKey | null = null;
const open = new Map<string, string>();
const pending = new Map<string, string>();
let installed = false;

const native =
  typeof Storage === "undefined"
    ? null
    : {
        get: Storage.prototype.getItem,
        set: Storage.prototype.setItem,
        remove: Storage.prototype.removeItem,
      };

function own(key: string): boolean {
  return key.startsWith("senda.") || key.startsWith("the-pit.");
}

function rawGet(key: string): string | null {
  if (!native) return null;
  return native.get.call(localStorage, key);
}

function rawSet(key: string, value: string) {
  if (!native) return;
  native.set.call(localStorage, key, value);
}

function rawRemove(key: string) {
  if (!native) return;
  native.remove.call(localStorage, key);
}

export function sealOpen(): boolean {
  return aes != null;
}

function tell() {
  window.dispatchEvent(new Event(EVENT));
}

async function aesFrom(sig: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", sig);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function pack(value: string): Promise<string> {
  if (!aes) throw new Error("The desk is sealed.");
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const box = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(value));
  return `${MARK}${b64(iv)}.${b64(new Uint8Array(box))}`;
}

async function unpack(stored: string): Promise<string | null> {
  if (!aes || !stored.startsWith(MARK)) return null;
  const cut = stored.indexOf(".", MARK.length);
  if (cut < 0) return null;
  try {
    const iv = unb64(stored.slice(MARK.length, cut));
    const box = unb64(stored.slice(cut + 1));
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes, box);
    return new TextDecoder().decode(clear);
  } catch {
    return null;
  }
}

async function writeCipher(key: string, value: string) {
  rawSet(key, await pack(value));
}

function install() {
  if (installed || typeof window === "undefined" || !native) return;
  installed = true;
  const store = Storage.prototype;
  store.getItem = function (key: string) {
    if (!own(key)) return rawGet(key);
    if (open.has(key)) return open.get(key) ?? null;
    if (!aes) return pending.get(key) ?? null;
    return null;
  };
  store.setItem = function (key: string, value: string) {
    if (!own(key)) {
      rawSet(key, value);
      return;
    }
    if (!aes) {
      pending.set(key, value);
      return;
    }
    open.set(key, value);
    void writeCipher(key, value);
  };
  store.removeItem = function (key: string) {
    if (!own(key)) {
      rawRemove(key);
      return;
    }
    open.delete(key);
    pending.delete(key);
    rawRemove(key);
  };
}

async function signVault(owner: string): Promise<Uint8Array> {
  const w = window as unknown as {
    phantom?: { solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> } };
    solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> };
  };
  const provider = w.phantom?.solana ?? w.solana;
  if (!provider?.signMessage) throw new Error("This wallet has to sign before the desk opens.");
  const out = await provider.signMessage(new TextEncoder().encode(`senda-vault:v1:${owner}`), "utf8");
  const sig = out instanceof Uint8Array ? out : out.signature;
  if (!(sig instanceof Uint8Array) || sig.length < 64) throw new Error("The wallet did not sign.");
  return sig;
}

export async function unlockSeal(owner: string): Promise<void> {
  install();
  aes = await aesFrom(await signVault(owner));
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && own(key)) keys.push(key);
  }
  for (const key of keys) {
    const stored = rawGet(key);
    if (!stored) continue;
    if (stored.startsWith(MARK)) {
      const clear = await unpack(stored);
      if (clear != null) open.set(key, clear);
    } else {
      open.set(key, stored);
      await writeCipher(key, stored);
    }
  }
  for (const [key, value] of pending) {
    open.set(key, value);
    await writeCipher(key, value);
  }
  pending.clear();
  tell();
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

install();
