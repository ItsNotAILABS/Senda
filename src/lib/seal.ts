import { finishGrant, listBlobs, openNonce, putBlob } from "@/lib/sealed-store";

/**
 * The wallet is the account. What the desk remembers is ciphertext.
 * The key lives in memory for this visit. It is the signature of one fixed line.
 * Postgres stores that ciphertext and nothing else. Flags the desk needs before
 * a wallet exists stay in the clear, and they are not uploaded.
 * While the vault is locked, that clear copy still reads and writes. Ciphertext
 * waiting on this wallet is not returned and is not overwritten.
 */

const MARK = "sen1.";
const EVENT = "senda-seal";
const PLAIN = new Set(["senda.seen.v1", "senda.howto.v1", "senda.passport.v1"]);

let aes: CryptoKey | null = null;
let door: "wallet" | "phone" = "wallet";
let who = "";
let grant = "";
const open = new Map<string, string>();
const pending = new Map<string, string>();
const dirty = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
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
  if (PLAIN.has(key)) return false;
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
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

async function aesFrom(sig: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", sig as BufferSource);
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
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, aes, box as BufferSource);
    return new TextDecoder().decode(clear);
  } catch {
    return null;
  }
}

async function writeCipher(key: string, value: string) {
  const box = await pack(value);
  rawSet(key, box);
  schedule(key, box);
}

function schedule(key: string, box: string) {
  if (!who || !grant) return;
  dirty.set(key, box);
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = [...dirty];
    dirty.clear();
    void Promise.all(batch.map(([slot, packed]) => putBlob({ data: { wallet: who, nonce: grant, slot, box: packed } }))).catch(() => {
      /* the browser copy is already sealed */
    });
  }, 400);
}

async function authorize(owner: string) {
  const opened = await openNonce({ data: { wallet: owner } });
  const provider = walletProvider();
  if (!provider?.signMessage) return;
  const out = await provider.signMessage(new TextEncoder().encode(`senda-grant:v1:${owner}:${opened.nonce}`), "utf8");
  const sig = out instanceof Uint8Array ? out : out.signature;
  if (!(sig instanceof Uint8Array)) return;
  const done = await finishGrant({ data: { wallet: owner, nonce: opened.nonce, sig: b64(sig) } });
  if (done.ok) grant = opened.nonce;
}

async function pull() {
  if (!who || !grant) return;
  const listed = await listBlobs({ data: { wallet: who, nonce: grant } });
  for (const row of listed.rows) {
    if (!own(row.slot) || open.has(row.slot)) continue;
    const clear = await unpack(row.box);
    if (clear == null) continue;
    open.set(row.slot, clear);
    rawSet(row.slot, row.box);
  }
}

async function pushOpen() {
  if (!who || !grant) return;
  for (const key of open.keys()) {
    const box = rawGet(key);
    if (!box || !box.startsWith(MARK)) continue;
    await putBlob({ data: { wallet: who, nonce: grant, slot: key, box } });
  }
}

function install() {
  if (installed || typeof window === "undefined" || !native) return;
  installed = true;
  const store = Storage.prototype;
  store.getItem = function (key: string) {
    if (!own(key)) return rawGet(key);
    if (aes) return open.has(key) ? (open.get(key) ?? null) : null;
    if (pending.has(key)) return pending.get(key) ?? null;
    const stored = rawGet(key);
    if (!stored || stored.startsWith(MARK)) return null;
    return stored;
  };
  store.setItem = function (key: string, value: string) {
    if (!own(key)) {
      rawSet(key, value);
      return;
    }
    if (!aes) {
      pending.set(key, value);
      const stored = rawGet(key);
      if (!stored || !stored.startsWith(MARK)) rawSet(key, value);
      return;
    }
    pending.delete(key);
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

export function sealState(): { open: boolean; door: "wallet" | "phone" | "locked" } {
  return { open: aes != null, door: aes ? door : "locked" };
}

/** Drop the in-memory key. Ciphertext stays on the device. */
export function lockSeal() {
  aes = null;
  who = "";
  grant = "";
  open.clear();
  pending.clear();
  tell();
}

async function absorb() {
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
}

/** A 32-byte master key already unwrapped on this device. Does not replace a key that is open. */
export async function unlockSealWithMaster(raw: Uint8Array): Promise<"opened" | "kept"> {
  install();
  if (aes) return "kept";
  if (raw.length !== 32) throw new Error("The phone key is the wrong size.");
  const copy = new Uint8Array(raw);
  try {
    aes = await crypto.subtle.importKey("raw", copy, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  } finally {
    copy.fill(0);
  }
  door = "phone";
  who = "";
  grant = "";
  await absorb();
  tell();
  return "opened";
}

async function signVault(owner: string): Promise<Uint8Array> {
  const provider = walletProvider();
  if (!provider?.signMessage) throw new Error("This wallet has to sign before the desk opens.");
  const out = await provider.signMessage(new TextEncoder().encode(`senda-vault:v1:${owner}`), "utf8");
  const sig = out instanceof Uint8Array ? out : out.signature;
  if (!(sig instanceof Uint8Array) || sig.length < 64) throw new Error("The wallet did not sign.");
  return sig;
}

function walletProvider(): {
  signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
} | null {
  const w = window as unknown as {
    phantom?: { solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> } };
    solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> };
  };
  return w.phantom?.solana ?? w.solana ?? null;
}

export async function unlockSeal(owner: string): Promise<void> {
  install();
  if (aes) return;
  who = owner;
  grant = "";
  aes = await aesFrom(await signVault(owner));
  door = "wallet";
  await absorb();
  try {
    await authorize(owner);
    await pull();
    await pushOpen();
  } catch {
    /* local seal still holds. the database is the copy, not the door. */
  }
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
