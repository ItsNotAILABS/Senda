import { finishGrant, readVault, openNonce, writeVault } from "@/lib/sealed-store";

const PLAIN = new Set(["senda.seen.v1", "senda.howto.v1"]);
const own = (key: string) => !PLAIN.has(key) && /^(senda|the-pit)\./.test(key);
const records = new Map<string, string>();
let aes: CryptoKey | null = null;
let who = "",
  token = "",
  generation = 0,
  revision = 0;
let dirty = false,
  syncing = false,
  conflict = false,
  edits = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let queue = Promise.resolve();
const native =
  typeof Storage === "undefined"
    ? null
    : {
        get: Storage.prototype.getItem,
        set: Storage.prototype.setItem,
        remove: Storage.prototype.removeItem,
      };
const rawGet = (key: string) => native!.get.call(localStorage, key);
const rawSet = (key: string, value: string) => native!.set.call(localStorage, key, value);
const keyFor = (owner: string) => `sealed-vault.v2.${owner}`;
const b64 = (v: Uint8Array) => btoa(Array.from(v, (b) => String.fromCharCode(b)).join(""));
const unb64 = (v: string) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
function tell() {
  window.dispatchEvent(new Event("senda-seal"));
}
function problem(error: unknown) {
  window.dispatchEvent(
    new CustomEvent("senda-sync-error", {
      detail:
        error instanceof Error
          ? error.message
          : "Encrypted sync is unavailable. Your local copy is preserved.",
    }),
  );
}
export function sealOpen() {
  return aes !== null;
}
export function lockSeal() {
  generation++;
  aes = null;
  who = "";
  token = "";
  records.clear();
  revision = 0;
  dirty = false;
  conflict = false;
  if (timer) clearTimeout(timer);
  timer = null;
  tell();
}
function provider() {
  const w = window as unknown as { phantom?: { solana?: Wallet }; solana?: Wallet };
  return w.phantom?.solana ?? w.solana;
}
type Wallet = {
  publicKey?: { toString(): string };
  signMessage?: (
    msg: Uint8Array,
    display?: string,
  ) => Promise<Uint8Array | { signature: Uint8Array }>;
  on?: (event: string, fn: () => void) => void;
};
export async function signWalletMessage(owner: string, message: string) {
  const p = provider();
  if (p?.publicKey?.toString() !== owner || !p.signMessage)
    throw new Error("Connect the matching wallet first.");
  const out = await p.signMessage(new TextEncoder().encode(message), "utf8");
  if (p.publicKey?.toString() !== owner) throw new Error("Wallet changed during approval.");
  const sig = out instanceof Uint8Array ? out : out.signature;
  if (sig.length !== 64) throw new Error("Invalid wallet signature.");
  return sig;
}
async function encrypt(key: CryptoKey, owner: string, entries: [string, string][]) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(entries));
  const box = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`senda-vault:v2:${owner}`) },
    key,
    data,
  );
  return `sen2.${b64(iv)}.${b64(new Uint8Array(box))}`;
}
async function decrypt(key: CryptoKey, owner: string, box: string): Promise<[string, string][]> {
  const [mark, iv, data] = box.split(".");
  if (mark !== "sen2") throw new Error("Unknown vault format.");
  const clear = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: unb64(iv),
      additionalData: new TextEncoder().encode(`senda-vault:v2:${owner}`),
    },
    key,
    unb64(data),
  );
  const entries: unknown = JSON.parse(new TextDecoder().decode(clear));
  if (
    !Array.isArray(entries) ||
    !entries.every(
      (e) =>
        Array.isArray(e) &&
        e.length === 2 &&
        typeof e[0] === "string" &&
        own(e[0]) &&
        typeof e[1] === "string",
    )
  )
    throw new Error("Invalid vault contents.");
  return entries as [string, string][];
}
async function legacy(key: CryptoKey, box: string) {
  const [mark, iv, data] = box.split(".");
  if (mark !== "sen1") return null;
  try {
    return new TextDecoder().decode(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(data)),
    );
  } catch {
    return null;
  }
}
function persist() {
  const g = generation,
    key = aes,
    owner = who,
    entries = [...records.entries()];
  if (!key || !owner) return Promise.resolve();
  queue = queue
    .catch(() => {})
    .then(async () => {
      const box = await encrypt(key, owner, entries);
      if (g !== generation) return;
      rawSet(keyFor(owner), JSON.stringify({ box, revision, dirty: true }));
    });
  return queue;
}
function schedule() {
  edits++;
  dirty = true;
  void persist()
    .then(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void sync().catch(problem);
      }, 500);
    })
    .catch(problem);
}
async function sync() {
  if (!aes || !token || !dirty || syncing || conflict) return;
  syncing = true;
  const g = generation,
    owner = who,
    auth = token,
    editing = edits;
  try {
    await queue;
    const local = JSON.parse(rawGet(keyFor(owner)) || "null") as { box: string } | null;
    if (!local || g !== generation) return;
    const result = await writeVault({
      data: { wallet: owner, token: auth, box: local.box, revision },
    });
    if (g !== generation) return;
    revision = result.revision;
    await queue;
    const latest = JSON.parse(rawGet(keyFor(owner)) || "null") as { box: string } | null;
    dirty = latest?.box !== local.box || edits !== editing;
    if (latest) rawSet(keyFor(owner), JSON.stringify({ ...latest, revision, dirty }));
  } catch (e) {
    // Never automatically retry an uncertain write or overwrite a newer device.
    conflict = true;
    problem(e);
  } finally {
    syncing = false;
    if (dirty && !conflict && g === generation) void sync().catch(problem);
  }
}
let watched: Wallet | undefined;
export async function unlockSeal(owner: string) {
  if (who === owner && aes) return;
  if (who && who !== owner) {
    lockSeal();
    window.location.reload();
    throw new Error("Reopening the desk for the new wallet.");
  }
  lockSeal();
  const g = generation;
  const sig = await signWalletMessage(owner, `senda-vault:v1:${owner}`);
  const key = await crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", new Uint8Array(sig)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  if (g !== generation) return;
  const loaded = new Map<string, string>();
  const local = JSON.parse(rawGet(keyFor(owner)) || "null") as {
    box: string;
    revision: number;
    dirty: boolean;
  } | null;
  let rev = 0,
    changed = false,
    auth = "",
    blocked = false;
  if (local) {
    for (const [k, v] of await decrypt(key, owner, local.box)) loaded.set(k, v);
    rev = local.revision;
    changed = local.dirty;
  } else {
    // One-time migration: encrypted legacy entries must decrypt for this owner.
    // Plaintext can be claimed by only the first wallet on this browser.
    const claimed = rawGet("sealed-legacy-owner");
    if (!claimed) rawSet("sealed-legacy-owner", owner);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !own(k)) continue;
      const value = rawGet(k);
      if (value === null) continue;
      const clear = value.startsWith("sen1.")
        ? await legacy(key, value)
        : !claimed || claimed === owner
          ? value
          : null;
      if (clear !== null) {
        loaded.set(k, clear);
        changed = true;
      }
    }
  }
  try {
    const challenge = await openNonce({ data: { wallet: owner } });
    const signed = await signWalletMessage(owner, challenge.message);
    auth = (
      await finishGrant({ data: { wallet: owner, nonce: challenge.nonce, sig: b64(signed) } })
    ).token;
    const remote = await readVault({ data: { wallet: owner, token: auth } });
    if (remote.vault) {
      if (changed && remote.vault.revision !== rev) {
        blocked = true;
        problem(
          new Error(
            "Sync conflict: local changes preserved. Reconcile this device before syncing.",
          ),
        );
      } else if (!changed) {
        loaded.clear();
        for (const [k, v] of await decrypt(key, owner, remote.vault.box)) loaded.set(k, v);
        rev = remote.vault.revision;
      }
    } else if (rev > 0) {
      blocked = true;
      problem(new Error("Remote vault missing. Local copy preserved."));
    } else
      for (const row of remote.legacy) {
        if (own(row.slot) && !loaded.has(row.slot)) {
          const clear = await legacy(key, row.box);
          if (clear !== null) {
            loaded.set(row.slot, clear);
            changed = true;
          }
        }
      }
  } catch (e) {
    problem(e);
    auth = "";
  }
  if (g !== generation) return;
  aes = key;
  who = owner;
  token = auth;
  revision = rev;
  dirty = changed;
  conflict = blocked;
  for (const [k, v] of loaded) records.set(k, v);
  const box = await encrypt(key, owner, [...records]);
  if (g !== generation) return;
  rawSet(keyFor(owner), JSON.stringify({ box, revision, dirty }));
  // Remove migrated plaintext only after its encrypted copy is safely stored.
  for (const k of loaded.keys()) {
    const old = rawGet(k);
    if (
      old !== null &&
      (old.startsWith("sen1.")
        ? (await legacy(key, old)) !== null
        : rawGet("sealed-legacy-owner") === owner)
    )
      native!.remove.call(localStorage, k);
  }
  const p = provider();
  if (p && p !== watched) {
    watched = p;
    for (const event of ["accountChanged", "disconnect"])
      p.on?.(event, () => {
        lockSeal();
        window.location.reload();
      });
  }
  tell();
  void sync().catch(problem);
}
if (native && typeof window !== "undefined") {
  Storage.prototype.getItem = function (key: string) {
    if (this !== localStorage || !own(key)) return native.get.call(this, key);
    return aes ? (records.get(key) ?? null) : null;
  };
  Storage.prototype.setItem = function (key: string, value: string) {
    if (this !== localStorage || !own(key)) {
      native.set.call(this, key, value);
      return;
    }
    if (!aes) return;
    records.set(key, String(value));
    schedule();
  };
  Storage.prototype.removeItem = function (key: string) {
    if (this !== localStorage || !own(key)) {
      native.remove.call(this, key);
      return;
    }
    if (!aes) return;
    records.delete(key);
    schedule();
  };
  window.addEventListener("online", () => {
    void sync().catch(problem);
  });
}
