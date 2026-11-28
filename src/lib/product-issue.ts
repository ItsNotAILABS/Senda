/** A product or a piece of software. The chain row is a thing hash. USDC moves only when Phantom signs a split of a price already set. */

import { PublicKey } from "@solana/web3.js";
import { draftThing, type ThingDraft, type ThingKind } from "./thing-route.ts";

export type IssueKind = "product" | "file" | "software" | "license" | "service";
export type SplitRole = "maker" | "contributor" | "held";

export type Leg = { role: SplitRole; to: string; usd: number };

export type Seat = { quota: number; left: number; until: number; revoked: boolean };

export type Edition = {
  serial: number;
  buyer: string;
  owner: string;
  sig: string;
  handSig: string;
  at: number;
  usd: number;
  sold: boolean;
  paid: Leg[];
  seat: Seat | null;
};

const KEY = "senda.issues.v1";

export type Issue = {
  id: string;
  kind: IssueKind;
  title: string;
  body: string;
  priceUsd: number;
  maker: string;
  contributor: string;
  reserve: string;
  makerBps: number;
  contributorBps: number;
  heldBps: number;
  allow: string;
  quota: number;
  days: number;
  parent: string;
  hash: string;
  line: string;
  thing: ThingKind;
  slot: number;
  sig: string;
  editions: Edition[];
  capUsd: number;
  capSpent: number;
  at: number;
};

export type IssuePlan = {
  kind: IssueKind;
  thing: ThingKind;
  title: string;
  body: string;
  priceUsd: number;
  maker: string;
  contributor: string;
  reserve: string;
  makerBps: number;
  contributorBps: number;
  heldBps: number;
  makerUsd: number;
  contributorUsd: number;
  heldUsd: number;
  allow: string;
  quota: number;
  days: number;
  parent: string;
  draft: ThingDraft;
  rule: Leg[];
};

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function address(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    return null;
  }
}

export function splitAmounts(
  priceUsd: number,
  makerBps: number,
  contributorBps: number,
  heldBps: number,
): { makerUsd: number; contributorUsd: number; heldUsd: number } | { error: string } {
  const parts = [makerBps, contributorBps, heldBps];
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 10000)) return { error: "Use whole percents." };
  if (makerBps + contributorBps + heldBps !== 10000) return { error: "The split has to add to 100." };
  const cents = Math.round(priceUsd * 100);
  if (!Number.isFinite(priceUsd) || cents < 1 || cents > 100_000_000) return { error: "Set a price in USDC." };
  const raw = parts.map((bps) => Math.floor((cents * bps) / 10000));
  const dust = cents - raw.reduce((sum, n) => sum + n, 0);
  const winner = parts
    .map((bps, index) => ({ bps, index }))
    .sort((a, b) => b.bps - a.bps || a.index - b.index)[0]?.index ?? 0;
  raw[winner] += dust;
  return { makerUsd: raw[0] / 100, contributorUsd: raw[1] / 100, heldUsd: raw[2] / 100 };
}

export function ruleLegs(input: {
  maker: string;
  contributor: string;
  reserve: string;
  makerUsd: number;
  contributorUsd: number;
  heldUsd: number;
}): Leg[] | { error: string } {
  const maker = address(input.maker);
  if (!maker) return { error: "The maker wallet is not a Solana address." };
  const contributor = input.contributorUsd > 0 ? address(input.contributor) : input.contributor.trim() ? address(input.contributor) : "";
  if (input.contributorUsd > 0 && !contributor) return { error: "The contributor's share needs their wallet." };
  if (contributor && contributor === maker) return { error: "The contributor is a different wallet. One wallet does not split with itself." };
  const reserve = input.reserve.trim() ? address(input.reserve) : "";
  if (input.reserve.trim() && !reserve) return { error: "The reserve wallet is not a Solana address." };
  if (reserve && reserve === maker) return { error: "Leave reserve blank to hold that share with the maker." };
  const heldTo = reserve || maker;
  const rows: Leg[] = [];
  if (input.makerUsd > 0) rows.push({ role: "maker", to: maker, usd: input.makerUsd });
  if (input.contributorUsd > 0 && contributor) rows.push({ role: "contributor", to: contributor, usd: input.contributorUsd });
  if (input.heldUsd > 0) rows.push({ role: "held", to: heldTo, usd: input.heldUsd });
  return rows;
}

/** What actually leaves the buyer's wallet. Paying yourself is dropped. Same address is one payment. */
export function payLegs(buyer: string, rule: Leg[]): { to: string; usd: number }[] {
  const who = address(buyer);
  const by = new Map<string, number>();
  for (const leg of rule) {
    if (who && leg.to === who) continue;
    if (!(leg.usd >= 0.01)) continue;
    by.set(leg.to, Math.round(((by.get(leg.to) || 0) + leg.usd) * 100) / 100);
  }
  return [...by.entries()].map(([to, usd]) => ({ to, usd }));
}

export function isSeat(kind: IssueKind): boolean {
  return kind === "software" || kind === "license" || kind === "service";
}

export function thingKindFor(kind: IssueKind, parent: string): ThingKind {
  if (parent) return "line";
  return isSeat(kind) ? "pass" : "seal";
}

export function planIssue(input: {
  kind: IssueKind;
  title: string;
  body: string;
  priceUsd: number;
  maker: string;
  makerBps: number;
  contributorBps: number;
  heldBps: number;
  contributor: string;
  reserve: string;
  allow: string;
  quota: number;
  days: number;
  parent: string;
  slot: number;
}): IssuePlan | { error: string } {
  if (!input.kind) return { error: "Pick what this is." };
  const amounts = splitAmounts(input.priceUsd, input.makerBps, input.contributorBps, input.heldBps);
  if ("error" in amounts) return amounts;
  const parent = clean(input.parent).toLowerCase();
  const seat = isSeat(input.kind);
  const quota = seat ? Math.round(input.quota) : 0;
  const days = seat ? Math.round(input.days) : 0;
  if (seat) {
    if (!(quota >= 1 && quota <= 1_000_000)) return { error: "Set how many uses this seat has." };
    if (!(days >= 1 && days <= 3650)) return { error: "Set how many days this seat lasts." };
  }
  const allow = clean(input.allow);
  if (allow.length < 2 || allow.length > 80) return { error: "Say what the holder may do, in a few words." };
  const note = [
    input.body.replace(/\r\n/g, "\n").trim(),
    `Kind ${input.kind}.`,
    `Price ${amounts.makerUsd + amounts.contributorUsd + amounts.heldUsd} USDC.`,
    `Split maker ${input.makerBps} contributor ${input.contributorBps} held ${input.heldBps}.`,
    `Allowed: ${allow}`,
    seat ? `Seat ${quota} uses, ${days} days. A license does not move.` : "This can change hands. The handoff is not a payment.",
    "This split is USDC already paid. It is not a claim on future revenue.",
  ].join("\n");
  const draft = draftThing({
    kind: thingKindFor(input.kind, parent),
    title: input.title,
    body: note,
    parent: parent || undefined,
    slot: input.slot,
  });
  if ("error" in draft) return draft;
  const rule = ruleLegs({
    maker: input.maker,
    contributor: input.contributor,
    reserve: input.reserve,
    makerUsd: amounts.makerUsd,
    contributorUsd: amounts.contributorUsd,
    heldUsd: amounts.heldUsd,
  });
  if ("error" in rule) return rule;
  return {
    kind: input.kind,
    thing: draft.kind,
    title: draft.title,
    body: input.body.replace(/\r\n/g, "\n").trim(),
    priceUsd: Math.round(input.priceUsd * 100) / 100,
    maker: rule.find((row) => row.role === "maker")?.to || address(input.maker) || "",
    contributor: input.contributorBps > 0 ? rule.find((row) => row.role === "contributor")?.to || "" : "",
    reserve: input.reserve.trim() ? rule.find((row) => row.role === "held")?.to || "" : "",
    makerBps: input.makerBps,
    contributorBps: input.contributorBps,
    heldBps: input.heldBps,
    makerUsd: amounts.makerUsd,
    contributorUsd: amounts.contributorUsd,
    heldUsd: amounts.heldUsd,
    allow,
    quota,
    days,
    parent: draft.parent === "-" ? "" : draft.parent,
    draft,
    rule,
  };
}

export function handoff(kind: IssueKind, holder: string, next: string): { ok: true; to: string } | { error: string } {
  if (kind !== "product" && kind !== "file") return { error: "A license does not move. Revoke the seat, or sell a new one." };
  const to = address(next);
  if (!to) return { error: "Hand it to a Solana address. No USDC moves." };
  if (address(holder) === to) return { error: "Hand it to a different wallet." };
  return { ok: true, to };
}

export function seatState(seat: Seat, now: number): "live" | "expired" | "revoked" | "used" {
  if (seat.revoked) return "revoked";
  if (seat.until > 0 && now > seat.until) return "expired";
  if (seat.left <= 0) return "used";
  return "live";
}

export function markUse(seat: Seat, now: number): Seat | { error: string } {
  if (seatState(seat, now) !== "live") return { error: "This seat is not live." };
  return { ...seat, left: seat.left - 1 };
}

export function spendAgainst(capUsd: number, spent: number, usd: number): { spent: number } | { error: string } {
  const cap = Math.round(capUsd * 100) / 100;
  const used = Math.round(spent * 100) / 100;
  const next = Math.round(usd * 100) / 100;
  if (!(cap > 0)) return { error: "Set a cap first." };
  if (!(next > 0)) return { error: "Enter an amount." };
  const left = Math.round((cap - used) * 100) / 100;
  if (next - left > 0.001) return { error: `The cap has $${left.toFixed(2)} left.` };
  return { spent: Math.round((used + next) * 100) / 100 };
}

export function loadIssues(): Issue[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Issue[];
    return Array.isArray(rows) ? rows.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function saveIssues(rows: Issue[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}
