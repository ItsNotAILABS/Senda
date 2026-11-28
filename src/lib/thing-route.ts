/** A thing on Solana. The token is a hash. It is not a balance, and it does not move USDC. */

import { sha256 } from "@noble/hashes/sha2.js";
import { PublicKey } from "@solana/web3.js";
import { MEMO_PROGRAM, SLOT_LIFE, edgeHash } from "./solana-edge.ts";

export const THING_KINDS = ["seal", "line", "pass", "hand"] as const;
export type ThingKind = (typeof THING_KINDS)[number];

export type ThingDraft = {
  kind: ThingKind;
  title: string;
  hash: string;
  parent: string;
  to: string;
  line: string;
  slot: number;
  until: number;
};

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function thingPreimage(input: {
  kind: ThingKind;
  title: string;
  body: string;
  parent: string;
  to: string;
  slot: number;
}): string {
  return ["senda.thing.1", input.kind, input.title, input.body, input.parent || "-", input.to || "-", String(input.slot)].join("\n");
}

function hex64(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

export function thingLine(input: { kind: ThingKind; hash: string; parent: string; to: string; slot: number }): string {
  if (input.kind === "line") return `senda.thing.1 line ${input.hash} parent ${input.parent} slot ${input.slot}`;
  if (input.kind === "hand") return `senda.thing.1 hand ${input.hash} to ${input.to} slot ${input.slot}`;
  return `senda.thing.1 ${input.kind} ${input.hash} slot ${input.slot}`;
}

/** Hash the thing against a slot. The title and the words stay out of the memo. */
export function draftThing(input: {
  kind: string;
  title: string;
  body: string;
  parent?: string;
  to?: string;
  slot: number;
}): ThingDraft | { error: string } {
  if (!THING_KINDS.includes(input.kind as ThingKind)) return { error: "Pick a seal, a lineage, a pass, or a handoff." };
  const kind = input.kind as ThingKind;
  const title = clean(input.title);
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (title.length < 2 || title.length > 48) return { error: "Name the thing in a few words." };
  if (body.length < 8 || body.length > 2000) return { error: "Write what it is. Those words do not go on the cluster." };
  if (!(Number.isInteger(input.slot) && input.slot > 0)) return { error: "The clock has no slot yet." };
  let parent = "-";
  if (kind === "line") {
    const raw = clean(input.parent || "genesis").toLowerCase();
    if (raw !== "genesis" && !hex64(raw)) return { error: "Lineage needs genesis, or the 64-character parent hash." };
    parent = raw;
  }
  let to = "-";
  if (kind === "hand") {
    try {
      to = new PublicKey(clean(input.to || "")).toBase58();
    } catch {
      return { error: "A handoff needs the other wallet. Nothing was sent." };
    }
  }
  const preimage = thingPreimage({ kind, title, body, parent, to, slot: input.slot });
  const hash = edgeHash(preimage);
  const line = thingLine({ kind, hash, parent, to, slot: input.slot });
  if (line.includes(body) || line.includes(title)) return { error: "The words leaked into the chain line. Nothing was sent." };
  if (new TextEncoder().encode(line).length > 500) return { error: "That line is too long for a memo." };
  return { kind, title, hash, parent, to, line, slot: input.slot, until: input.slot + SLOT_LIFE };
}

/** A name derived from the wallet and the title. Off the curve, so it cannot hold SOL and it cannot spend. */
export function thingName(owner: string, kind: ThingKind, title: string): { address: string; onCurve: boolean } {
  const who = new PublicKey(owner);
  const seed = sha256(new TextEncoder().encode(`${kind}\n${clean(title)}`)).slice(0, 32);
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("thing"), new TextEncoder().encode(kind), seed, who.toBytes()],
    MEMO_PROGRAM,
  );
  return { address: pda.toBase58(), onCurve: PublicKey.isOnCurve(pda.toBytes()) };
}
