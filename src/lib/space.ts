/**
 * A space is two wallets and a key this page cannot read.
 * The secret stays in this browser. A copied card has only public keys and signatures.
 * Nothing here is a Senda balance.
 */

import { PublicKey } from "@solana/web3.js";
import { connectPhantom, phantomProvider } from "@/lib/phantom";

const BOX = "senda.space.v1";

export type Arm = { x25519: string; sig: string };

export type SpaceEvent = {
  id: string;
  from: string;
  iv: string;
  box: string;
  tx: string | null;
};

export type Space = {
  nonce: string;
  members: [string, string];
  arms: Record<string, Arm>;
  events: SpaceEvent[];
};

type Secret = { secret: JsonWebKey };

type BoxFile = { spaces: Record<string, Space>; secrets: Record<string, Secret> };

function empty(): BoxFile {
  return { spaces: {}, secrets: {} };
}

function read(): BoxFile {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(BOX);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as BoxFile;
    if (!parsed?.spaces || !parsed?.secrets) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function write(file: BoxFile) {
  window.localStorage.setItem(BOX, JSON.stringify(file));
}

export function pubkey(value: string): string {
  return new PublicKey(value.trim()).toBase58();
}

export function membersOf(a: string, b: string): [string, string] {
  const left = pubkey(a);
  const right = pubkey(b);
  if (left === right) throw new Error("A room needs two wallets.");
  return left < right ? [left, right] : [right, left];
}

export function spaceId(members: [string, string], nonce: string): string {
  return `${members[0]}.${members[1]}.${nonce}`;
}

export function signText(members: [string, string], nonce: string, x25519: string): string {
  return `senda-space:${members[0]}:${members[1]}:${nonce}:${x25519}`;
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

export function loadSpace(id: string): Space | null {
  return read().spaces[id] ?? null;
}

export function publicCard(space: Space): string {
  return JSON.stringify({
    v: 1,
    nonce: space.nonce,
    members: space.members,
    arms: space.arms,
  });
}

export function rememberCard(card: string): Space {
  const parsed = JSON.parse(card) as { nonce?: string; members?: string[]; arms?: Record<string, Arm> };
  if (!parsed.nonce || !parsed.members || parsed.members.length !== 2) throw new Error("That card is not a room.");
  const members = membersOf(parsed.members[0], parsed.members[1]);
  const id = spaceId(members, parsed.nonce);
  const file = read();
  const prev = file.spaces[id];
  const arms = { ...(prev?.arms ?? {}), ...(parsed.arms ?? {}) };
  const next: Space = { nonce: parsed.nonce, members, arms, events: prev?.events ?? [] };
  file.spaces[id] = next;
  write(file);
  return next;
}

async function x25519(): Promise<{ publicRaw: Uint8Array; secret: JsonWebKey }> {
  const pair = await crypto.subtle.generateKey({ name: "X25519" } as AlgorithmIdentifier, true, ["deriveBits"]) as CryptoKeyPair;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const secret = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicRaw, secret };
}

async function signWithWallet(text: string): Promise<Uint8Array> {
  const provider = phantomProvider() as {
    signMessage?: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
  } | null;
  if (!provider?.signMessage) throw new Error("This wallet cannot sign the room.");
  const out = await provider.signMessage(new TextEncoder().encode(text), "utf8");
  const sig = out instanceof Uint8Array ? out : out.signature;
  if (!(sig instanceof Uint8Array) || sig.length < 64) throw new Error("The wallet did not return a signature.");
  return sig;
}

export async function verifyArm(owner: string, members: [string, string], nonce: string, arm: Arm): Promise<boolean> {
  const text = signText(members, nonce, arm.x25519);
  const key = await crypto.subtle.importKey("raw", new Uint8Array(new PublicKey(owner).toBytes()), { name: "Ed25519" } as AlgorithmIdentifier, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" } as AlgorithmIdentifier, key, b64(arm.sig), new TextEncoder().encode(text));
}

/** Opens the room as this wallet. Stores the secret here. Returns the public card. */
export async function openSpace(me: string, them: string, nonce: string): Promise<{ id: string; space: Space }> {
  const owner = pubkey(me);
  const members = membersOf(owner, them);
  const id = spaceId(members, nonce);
  const made = await x25519();
  const xHex = hex(made.publicRaw);
  const text = signText(members, nonce, xHex);
  const sig = await signWithWallet(text);
  const arm: Arm = { x25519: xHex, sig: b64e(sig) };
  if (!(await verifyArm(owner, members, nonce, arm))) throw new Error("This browser could not check the signature it just made.");
  const file = read();
  const prev = file.spaces[id];
  file.secrets[`${id}:${owner}`] = { secret: made.secret };
  file.spaces[id] = {
    nonce,
    members,
    arms: { ...(prev?.arms ?? {}), [owner]: arm },
    events: prev?.events ?? [],
  };
  write(file);
  return { id, space: file.spaces[id] };
}

export async function connectMine(): Promise<string> {
  return pubkey(await connectPhantom());
}

async function roomKey(id: string, me: string, space: Space): Promise<CryptoKey> {
  const mine = read().secrets[`${id}:${me}`];
  if (!mine) throw new Error("This browser does not have your key for this room. Open it from this wallet.");
  const other = space.members.find((m) => m !== me);
  const their = other ? space.arms[other] : undefined;
  if (!their) throw new Error("Their key is not in the room yet.");
  const mineOk = space.arms[me] ? await verifyArm(me, space.members, space.nonce, space.arms[me]) : false;
  const theirOk = await verifyArm(other as string, space.members, space.nonce, their);
  if (!mineOk || !theirOk) throw new Error("A key in this room does not match the wallet that signed it.");
  const priv = await crypto.subtle.importKey("jwk", mine.secret, { name: "X25519" } as AlgorithmIdentifier, false, ["deriveBits"]);
  const pub = await crypto.subtle.importKey("raw", unhex(their.x25519), { name: "X25519" } as AlgorithmIdentifier, false, []);
  const bits = await crypto.subtle.deriveBits({ name: "X25519", public: pub } as AlgorithmIdentifier, priv, 256);
  const aes = await crypto.subtle.digest("SHA-256", bits);
  return crypto.subtle.importKey("raw", aes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function attachReceipt(id: string, me: string, tx: string): Space {
  const file = read();
  const space = file.spaces[id];
  if (!space) throw new Error("Open the room first.");
  space.events = [{ id: tx.slice(0, 12), from: pubkey(me), iv: "", box: "", tx }, ...space.events].slice(0, 20);
  file.spaces[id] = space;
  write(file);
  return space;
}

export async function sealNote(id: string, me: string, text: string, tx: string | null): Promise<Space> {
  const file = read();
  const space = file.spaces[id];
  if (!space) throw new Error("Open the room first.");
  const clean = text.trim();
  if (!clean && !tx) throw new Error("Write a note or attach a transfer.");
  const key = await roomKey(id, pubkey(me), space);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const body = new TextEncoder().encode(JSON.stringify({ text: clean, tx }));
  const box = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body);
  space.events = [
    { id: hex(iv).slice(0, 12), from: pubkey(me), iv: b64e(iv), box: b64e(new Uint8Array(box)), tx },
    ...space.events,
  ].slice(0, 20);
  file.spaces[id] = space;
  write(file);
  return space;
}

export async function readNote(id: string, me: string, event: SpaceEvent): Promise<string> {
  const space = loadSpace(id);
  if (!space) throw new Error("No room.");
  const key = await roomKey(id, pubkey(me), space);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(event.iv) }, key, b64(event.box));
  const parsed = JSON.parse(new TextDecoder().decode(clear)) as { text?: string };
  return parsed.text || "";
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unhex(value: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function b64e(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
