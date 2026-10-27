/**
 * A room between two wallets. The note is AES-GCM. The server never sees the key.
 * The private key stays in this browser. The card that is copied has none of it.
 */

import { PublicKey } from "@solana/web3.js";
import { b64d, b64e } from "@/lib/b64";
import { connectPhantom } from "@/lib/phantom";

const KEY = "senda.space.v1";

export type Arm = { pub: string; sig: string };
export type SpaceEvent = { id: string; from: string; iv?: string; box?: string; tx?: string | null };
export type Space = {
  nonce: string;
  members: [string, string];
  arms: Record<string, Arm>;
  events: SpaceEvent[];
};

type RoomFile = { rooms: Record<string, Space>; secrets: Record<string, string> };
type Card = { v: 1; nonce: string; members: [string, string]; arms: Record<string, Arm> };

type Signer = {
  signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
};

function provider(): Signer | null {
  const w = window as unknown as { phantom?: { solana?: Signer }; solana?: Signer };
  return w.phantom?.solana ?? w.solana ?? null;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unhex(value: string): Uint8Array {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function empty(): RoomFile {
  return { rooms: {}, secrets: {} };
}

function load(): RoomFile {
  if (typeof window === "undefined") return empty();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "") as RoomFile;
    if (!raw || typeof raw !== "object" || !raw.rooms || !raw.secrets) return empty();
    return raw;
  } catch {
    return empty();
  }
}

function write(file: RoomFile) {
  localStorage.setItem(KEY, JSON.stringify(file));
}

function secretKey(id: string, wallet: string): string {
  return `${id}:${wallet}`;
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

export function membersOf(a: string, b: string): [string, string] {
  let left: string;
  let right: string;
  try {
    left = new PublicKey(a.trim()).toBase58();
    right = new PublicKey(b.trim()).toBase58();
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (left === right) throw new Error("A room needs two different wallets.");
  return left < right ? [left, right] : [right, left];
}

export function spaceId(members: readonly string[], nonce: string): string {
  return `${members[0]}:${members[1]}:${nonce}`;
}

function line(members: [string, string], nonce: string, pub: string): string {
  return `senda-space:${members[0]}:${members[1]}:${nonce}:${pub}`;
}

async function verifyArm(owner: string, members: [string, string], nonce: string, arm: Arm): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", new PublicKey(owner).toBytes() as BufferSource, { name: "Ed25519" } as AlgorithmIdentifier, false, ["verify"]);
    return crypto.subtle.verify({ name: "Ed25519" } as AlgorithmIdentifier, key, b64d(arm.sig) as BufferSource, new TextEncoder().encode(line(members, nonce, arm.pub)));
  } catch {
    return false;
  }
}

export async function connectMine(): Promise<string> {
  return connectPhantom();
}

export function publicCard(space: Space): string {
  const card: Card = { v: 1, nonce: space.nonce, members: space.members, arms: space.arms };
  return JSON.stringify(card);
}

export function rememberCard(raw: string): Space {
  let card: Card;
  try {
    card = JSON.parse(raw) as Card;
  } catch {
    throw new Error("That card is not a room.");
  }
  if (card.v !== 1 || !card.nonce || !Array.isArray(card.members) || card.members.length !== 2) throw new Error("That card is not a room.");
  const members = membersOf(card.members[0], card.members[1]);
  const id = spaceId(members, card.nonce);
  const file = load();
  const prev = file.rooms[id];
  const arms = { ...(prev?.arms || {}), ...(card.arms || {}) };
  const space: Space = { nonce: card.nonce, members, arms, events: prev?.events || [] };
  file.rooms[id] = space;
  write(file);
  return space;
}

export async function openSpace(me: string, them: string, nonce: string): Promise<{ id: string; space: Space }> {
  const members = membersOf(me, them);
  const owner = new PublicKey(me.trim()).toBase58();
  const id = spaceId(members, nonce);
  const file = load();
  const space: Space = file.rooms[id] || { nonce, members, arms: {}, events: [] };
  const slot = secretKey(id, owner);
  let jwk = file.secrets[slot];
  let pub = space.arms[owner]?.pub || "";
  if (!jwk || !pub) {
    const pair = (await crypto.subtle.generateKey({ name: "X25519" } as AlgorithmIdentifier, true, ["deriveBits"])) as CryptoKeyPair;
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    pub = hex(raw);
    jwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
    const signer = provider();
    if (!signer?.signMessage) throw new Error("This wallet has to sign the room.");
    const out = await signer.signMessage(new TextEncoder().encode(line(members, nonce, pub)), "utf8");
    const sig = out instanceof Uint8Array ? out : out.signature;
    if (!(sig instanceof Uint8Array)) throw new Error("The wallet did not sign the room.");
    const arm = { pub, sig: b64e(sig) };
    if (!(await verifyArm(owner, members, nonce, arm))) throw new Error("That signature does not belong to this wallet.");
    space.arms[owner] = arm;
    file.secrets[slot] = jwk;
  }
  file.rooms[id] = space;
  write(file);
  return { id, space };
}

async function roomKey(id: string, me: string, space: Space): Promise<CryptoKey> {
  const mine = space.arms[me];
  const other = space.members.find((m) => m !== me);
  const theirs = other ? space.arms[other] : undefined;
  if (!mine || !theirs || !other) throw new Error("Their key is not in the room yet.");
  if (!(await verifyArm(me, space.members, space.nonce, mine))) throw new Error("This browser's key does not verify.");
  if (!(await verifyArm(other, space.members, space.nonce, theirs))) throw new Error("Their key does not verify.");
  const file = load();
  const jwk = file.secrets[secretKey(id, me)];
  if (!jwk) throw new Error("This browser does not hold the key for this room.");
  const mineKey = await crypto.subtle.importKey("jwk", JSON.parse(jwk) as JsonWebKey, { name: "X25519" } as AlgorithmIdentifier, false, ["deriveBits"]);
  const theirKey = await crypto.subtle.importKey("raw", unhex(theirs.pub) as BufferSource, { name: "X25519" } as AlgorithmIdentifier, false, []);
  const bits = await crypto.subtle.deriveBits({ name: "X25519", public: theirKey } as Algorithm, mineKey, 256);
  const digest = await crypto.subtle.digest("SHA-256", bits);
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function loadSpace(id: string): Space | null {
  return load().rooms[id] || null;
}

export async function sealNote(id: string, me: string, text: string, tx: string | null): Promise<Space> {
  const space = loadSpace(id);
  if (!space) throw new Error("No room.");
  const owner = new PublicKey(me.trim()).toBase58();
  const key = await roomKey(id, owner, space);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const body = new TextEncoder().encode(JSON.stringify({ text, tx }));
  const box = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body);
  const event: SpaceEvent = { id: newNonce(), from: owner, iv: b64e(iv), box: b64e(new Uint8Array(box)), tx };
  space.events = [event, ...space.events].slice(0, 20);
  const file = load();
  file.rooms[id] = space;
  write(file);
  return space;
}

export function attachReceipt(id: string, me: string, tx: string): Space {
  const space = loadSpace(id);
  if (!space) throw new Error("No room.");
  const owner = new PublicKey(me.trim()).toBase58();
  space.events = [{ id: newNonce(), from: owner, tx }, ...space.events].slice(0, 20);
  const file = load();
  file.rooms[id] = space;
  write(file);
  return space;
}

export async function readNote(id: string, me: string, event: SpaceEvent): Promise<string> {
  const space = loadSpace(id);
  if (!space) throw new Error("No room.");
  if (!event.iv || !event.box) throw new Error("That event has no note.");
  const key = await roomKey(id, new PublicKey(me.trim()).toBase58(), space);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(event.iv) as BufferSource }, key, b64d(event.box) as BufferSource);
  const parsed = JSON.parse(new TextDecoder().decode(clear)) as { text?: string };
  return parsed.text || "";
}
