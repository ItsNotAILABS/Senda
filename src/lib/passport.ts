/** On-device passport. The biometric or passphrase unwraps a master key. It is not the identity. */

import nacl from "tweetnacl";
import { openText, sealText } from "@/lib/private-box";
import { lockSeal, sealState, unlockSealWithMaster } from "@/lib/seal";

export const PASSPORT_KEY = "senda.passport.v1";
export const SECTIONS = ["money", "private", "crew"] as const;
const DAY = 24 * 60 * 60 * 1000;

export type Section = (typeof SECTIONS)[number];
export type Door = "opened" | "kept";

export type Receipt = {
  agent: string;
  section: Section;
  exp: number;
  nonce: string;
  pub: string;
  signature: string;
};

type Bag = { m: string; s: string };
type Box = { iv: string; box: string };
type Stored = {
  v: 1;
  pub: string;
  wrap: "prf" | "pass";
  credId?: string;
  prfSalt?: string;
  pass?: { salt: string; iv: string; box: string };
  prf?: Box;
  grants: Box | null;
  latest: Receipt | null;
};

let master: Uint8Array | null = null;
let secret: Uint8Array | null = null;
let pub = "";

export function passportUnlocked(): boolean {
  return master != null && secret != null && pub.length > 0;
}

export function passportPublic(): string {
  return pub;
}

export function lockPassport() {
  const phone = sealState().door === "phone";
  master?.fill(0);
  secret?.fill(0);
  master = null;
  secret = null;
  pub = "";
  if (phone) lockSeal();
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

function readStore(): Stored | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PASSPORT_KEY);
    if (!raw || raw.startsWith("sen1.")) return null;
    const row = JSON.parse(raw) as Stored;
    if (row?.v !== 1 || (row.wrap !== "prf" && row.wrap !== "pass") || typeof row.pub !== "string") return null;
    return row;
  } catch {
    return null;
  }
}

function writeStore(row: Stored) {
  localStorage.setItem(PASSPORT_KEY, JSON.stringify(row));
}

export function passportMeta(): { wrap: "prf" | "pass"; pub: string } | null {
  const row = readStore();
  if (!row) return null;
  return { wrap: row.wrap, pub: row.pub };
}

export function grantBytes(row: Pick<Receipt, "agent" | "section" | "exp" | "nonce">): Uint8Array {
  return new TextEncoder().encode(["SENDA-GRANT-v1", row.agent, row.section, String(row.exp), row.nonce].join("\n"));
}

export function verifyReceipt(row: Receipt): boolean {
  try {
    const sig = unb64(row.signature);
    const key = unb64(row.pub);
    if (sig.length !== nacl.sign.signatureLength || key.length !== nacl.sign.publicKeyLength) return false;
    if (!SECTIONS.includes(row.section) || !(row.exp > 0)) return false;
    return nacl.sign.detached.verify(grantBytes(row), sig, key);
  } catch {
    return false;
  }
}

export function visibleReceipt(): { receipt: Receipt; ok: boolean; live: boolean } | null {
  const store = readStore();
  const row = store?.latest;
  if (!store || !row) return null;
  const ok = verifyReceipt(row) && row.pub === store.pub;
  return { receipt: row, ok, live: ok && row.exp > Date.now() };
}

function agentName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 24) throw new Error("Name the agent in 24 characters or fewer.");
  if (!/^[\w .'-]+$/.test(name)) throw new Error("Use letters and numbers for the agent.");
  return name;
}

function asError(e: unknown, fallback: string): Error {
  if (typeof DOMException !== "undefined" && e instanceof DOMException) {
    if (e.name === "NotAllowedError") return new Error("The phone did not approve.");
    if (e.name === "SecurityError" || e.name === "NotSupportedError") {
      return new Error("This page cannot ask the phone for a key. Use a passphrase.");
    }
  }
  if (e instanceof Error && e.message) return e;
  return new Error(fallback);
}

type Minted = { master: Uint8Array; secret: Uint8Array; pub: Uint8Array; json: string };

function mint(): Minted {
  const pair = nacl.sign.keyPair();
  const key = nacl.randomBytes(32);
  const json = JSON.stringify({ m: b64(key), s: b64(pair.secretKey) } satisfies Bag);
  return { master: key, secret: pair.secretKey, pub: pair.publicKey, json };
}

function hold(row: Minted) {
  master = row.master;
  secret = row.secret;
  pub = b64(row.pub);
}

function wipeMint(row: Minted) {
  row.master.fill(0);
  row.secret.fill(0);
}

async function aesWrap(keyBytes: Uint8Array, plain: string): Promise<Box> {
  if (keyBytes.length !== 32) throw new Error("The phone key is the wrong size.");
  const copy = new Uint8Array(keyBytes);
  try {
    const key = await crypto.subtle.importKey("raw", copy, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const box = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
    return { iv: b64(iv), box: b64(box) };
  } finally {
    copy.fill(0);
  }
}

async function aesOpen(keyBytes: Uint8Array, boxed: Box): Promise<string> {
  const copy = new Uint8Array(keyBytes);
  try {
    const key = await crypto.subtle.importKey("raw", copy, { name: "AES-GCM" }, false, ["decrypt"]);
    const iv = unb64(boxed.iv);
    const data = unb64(boxed.box);
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, data as BufferSource);
    return new TextDecoder().decode(clear);
  } catch {
    throw new Error("The phone key did not open this.");
  } finally {
    copy.fill(0);
  }
}

function parseBag(json: string): Minted {
  const bag = JSON.parse(json) as Bag;
  const key = unb64(bag.m);
  const sec = unb64(bag.s);
  if (key.length !== 32 || sec.length !== nacl.sign.secretKeyLength) throw new Error("The wrapped key is not a passport.");
  const pair = nacl.sign.keyPair.fromSecretKey(sec);
  return { master: key, secret: sec, pub: pair.publicKey, json };
}

async function finish(row: Minted, stored: Stored): Promise<{ pub: string; door: Door }> {
  stored.grants = await aesWrap(row.master, "[]");
  stored.latest = null;
  writeStore(stored);
  hold(row);
  const door = await unlockSealWithMaster(row.master);
  return { pub: stored.pub, door };
}

export async function createPassphrasePassport(passphrase: string): Promise<{ pub: string; door: Door }> {
  if (readStore()) throw new Error("A passport is already on this phone. Unlock it.");
  const row = mint();
  try {
    const pass = await sealText(row.json, passphrase);
    const stored: Stored = { v: 1, pub: b64(row.pub), wrap: "pass", pass, prf: undefined, grants: null, latest: null };
    return await finish(row, stored);
  } catch (e) {
    wipeMint(row);
    throw e;
  }
}

function prfOut(cred: PublicKeyCredential): Uint8Array | null {
  const ext = cred.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } };
  const first = ext.prf?.results?.first;
  if (!first || first.byteLength < 32) return null;
  return new Uint8Array(first.slice(0, 32));
}

export async function createPhonePassport(): Promise<{ pub: string; door: Door }> {
  if (readStore()) throw new Error("A passport is already on this phone. Unlock it.");
  if (typeof window === "undefined" || !window.isSecureContext || !window.PublicKeyCredential) {
    throw new Error("This page cannot ask the phone for a key. Use a passphrase.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const user = crypto.getRandomValues(new Uint8Array(16));
  let cred: Credential | null;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Senda", id: window.location.hostname },
        user: { id: user, name: "Senda passport", displayName: "Senda passport" },
        pubKeyCredParams: [
          { type: "public-key", alg: -8 },
          { type: "public-key", alg: -7 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60_000,
        extensions: { prf: { eval: { first: salt } } },
      } as PublicKeyCredentialCreationOptions,
    });
  } catch (e) {
    throw asError(e, "The phone did not create a key.");
  }
  if (!(cred instanceof PublicKeyCredential)) throw new Error("The phone did not create a key.");
  const prf = prfOut(cred);
  if (!prf) throw new Error("This phone did not return a key. Use a passphrase. A prompt alone is not encryption.");
  const row = mint();
  try {
    const boxed = await aesWrap(prf, row.json);
    const stored: Stored = {
      v: 1,
      pub: b64(row.pub),
      wrap: "prf",
      credId: b64(new Uint8Array(cred.rawId)),
      prfSalt: b64(salt),
      prf: boxed,
      grants: null,
      latest: null,
    };
    return await finish(row, stored);
  } catch (e) {
    wipeMint(row);
    throw e;
  } finally {
    prf.fill(0);
  }
}

export async function unlockPassphrasePassport(passphrase: string): Promise<{ pub: string; door: Door }> {
  const stored = readStore();
  if (!stored || stored.wrap !== "pass" || !stored.pass) throw new Error("This passport does not use a passphrase.");
  const json = await openText(stored.pass, passphrase);
  const row = parseBag(json);
  if (b64(row.pub) !== stored.pub) {
    wipeMint(row);
    throw new Error("The wrapped key does not match this passport.");
  }
  hold(row);
  const door = await unlockSealWithMaster(row.master);
  return { pub: stored.pub, door };
}

export async function unlockPhonePassport(): Promise<{ pub: string; door: Door }> {
  const stored = readStore();
  if (!stored || stored.wrap !== "prf" || !stored.credId || !stored.prfSalt || !stored.prf) {
    throw new Error("This passport does not use the phone key.");
  }
  let cred: Credential | null;
  try {
    cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        userVerification: "required",
        timeout: 60_000,
        allowCredentials: [{ type: "public-key", id: unb64(stored.credId) }],
        extensions: { prf: { eval: { first: unb64(stored.prfSalt) } } },
      } as PublicKeyCredentialRequestOptions,
    });
  } catch (e) {
    throw asError(e, "The phone did not approve.");
  }
  if (!(cred instanceof PublicKeyCredential)) throw new Error("The phone did not approve.");
  const prf = prfOut(cred);
  if (!prf) throw new Error("This phone did not return a key. A prompt alone is not encryption.");
  try {
    const json = await aesOpen(prf, stored.prf);
    const row = parseBag(json);
    if (b64(row.pub) !== stored.pub) {
      wipeMint(row);
      throw new Error("The wrapped key does not match this passport.");
    }
    hold(row);
    const door = await unlockSealWithMaster(row.master);
    return { pub: stored.pub, door };
  } finally {
    prf.fill(0);
  }
}

export async function approveSection(agent: string, section: Section): Promise<Receipt> {
  if (!secret || !master || !pub) throw new Error("Open the passport first.");
  const name = agentName(agent);
  if (!SECTIONS.includes(section)) throw new Error("Pick one section.");
  const stored = readStore();
  if (!stored || stored.pub !== pub) throw new Error("The passport file does not match this visit.");
  const receipt: Receipt = {
    agent: name,
    section,
    exp: Date.now() + DAY,
    nonce: b64(nacl.randomBytes(16)),
    pub,
    signature: "",
  };
  receipt.signature = b64(nacl.sign.detached(grantBytes(receipt), secret));
  if (!verifyReceipt(receipt)) throw new Error("The receipt did not check. Nothing was saved.");
  stored.grants = await aesWrap(master, JSON.stringify([receipt]));
  stored.latest = receipt;
  writeStore(stored);
  return receipt;
}
