/** ZelleUSD settlement drill.
 * The 16 Nov 2026 Breakpoint transfer hid the dollars and left the payment
 * itself on the tape. This is that shape, in this tab. It is not a mainnet
 * mint, not a Zelle API, and not a signature. */

import { sha256 } from "@noble/hashes/sha2.js";

export const FLOAT = 5_000_000;
export const MAX_HIDDEN = 2_500_000;
const MIN = 1;

export type Desk = "anchorage" | "alpha" | "beta";
export type Lens = "public" | "alpha" | "beta" | "zelle" | "anchorage";
export type Purpose = "settlement" | "remit-in";
export type Kind = "issue" | "shield" | "send" | "accept" | "reveal" | "return" | "freeze" | "thaw" | "claw";

export type Rng = () => string;

export const DESKS: { id: Desk; name: string; role: string }[] = [
  { id: "anchorage", name: "Anchorage", role: "Issuer treasury" },
  { id: "alpha", name: "Bank Alpha", role: "Sending bank" },
  { id: "beta", name: "Bank Beta", role: "Receiving bank" },
];

/** Rails around the same announcement that are not wired, on purpose. */
export const WATCH: { name: string; status: string; line: string }[] = [
  {
    name: "ZLUSD",
    status: "Devnet drill",
    line: "Early Warning Services. Issued by Anchorage Digital Bank. Shown at Breakpoint on 16 Nov 2026. No mainnet mint is published, so nothing here is pasted into Phantom.",
  },
  {
    name: "USDPT",
    status: "Live mint",
    line: "Western Union’s dollar, issued by Anchorage on Solana. Jupiter lists the verified mint. The public pool is thin, so this drill does not swap it. Cash at their counter is their network, not a signature here.",
  },
  {
    name: "USAT",
    status: "Not connected",
    line: "Tether’s US bank dollar, issued by Anchorage. A different stable. Not spendable on this desk.",
  },
  {
    name: "Payoneer",
    status: "On the stage",
    line: "The Breakpoint screen put Payoneer on the fiat edge of the transfer. This desk has no Payoneer key and will not invent a ramp.",
  },
  {
    name: "US → India",
    status: "Announced",
    line: "Zelle’s first international corridor, aimed before the end of 2026. A remit stamp labels the settlement. It does not pay a UPI id.",
  },
  {
    name: "Token-2022",
    status: "Modeled here",
    line: "Confidential transfer, a required memo, issuer freeze, and a claw that reaches public dollars only. Circle USDC is the older token program. It is not wrapped into ZLUSD.",
  },
];

type Bucket = { pub: number; conf: number; frozen: boolean };

type Secret = { id: string; usd: number; blind: string; commitment: string };

type Pending = Secret & { from: Desk; to: Desk; purpose: Purpose; memo: string; at: number };

type Line = {
  id: string;
  at: number;
  kind: Kind;
  from: Desk;
  to: Desk;
  commitment: string;
  purpose: Purpose | "";
  memo: string;
  publicUsd: number | null;
};

export type Rail = {
  n: number;
  buckets: Record<Desk, Bucket>;
  pending: Pending[];
  secrets: Secret[];
  tape: Line[];
};

export type Result = { ok: true; rail: Rail } | { ok: false; error: string };

export type BucketView = {
  id: Desk;
  name: string;
  role: string;
  pub: number;
  conf: number | null;
  frozen: boolean;
};

export type PendingView = {
  id: string;
  from: Desk;
  to: Desk;
  purpose: Purpose;
  memo: string;
  at: number;
  usd: number | null;
  commitment: string;
  canAccept: boolean;
};

export type TapeView = {
  id: string;
  at: number;
  kind: Kind;
  from: Desk;
  to: Desk;
  purpose: Purpose | "";
  memo: string;
  commitment: string;
  usd: number | null;
  hidden: boolean;
  broken: boolean;
};

export type RailView = {
  lens: Lens;
  buckets: BucketView[];
  pending: PendingView[];
  tape: TapeView[];
  canMove: boolean;
};

export function fresh(): Rail {
  const zero = (): Bucket => ({ pub: 0, conf: 0, frozen: false });
  return {
    n: 1,
    buckets: {
      anchorage: { pub: FLOAT, conf: 0, frozen: false },
      alpha: zero(),
      beta: zero(),
    },
    pending: [],
    secrets: [],
    tape: [],
  };
}

export function commitment(usd: number, blind: string): string {
  const cents = Math.round(usd * 100);
  const raw = sha256(new TextEncoder().encode(`sen-zlusd-v1\n${cents}\n${blind}`));
  let hex = "";
  for (const b of raw) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function openingHolds(usd: number, blind: string, hash: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(blind) || !/^[0-9a-f]{64}$/.test(hash)) return false;
  return commitment(usd, blind) === hash;
}

export function randomBlind(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function fail(error: string): Result {
  return { ok: false, error };
}

function next(rail: Rail): { rail: Rail; id: string } {
  const id = `Z${String(rail.n).padStart(4, "0")}`;
  return {
    rail: {
      ...rail,
      n: rail.n + 1,
      buckets: {
        anchorage: { ...rail.buckets.anchorage },
        alpha: { ...rail.buckets.alpha },
        beta: { ...rail.buckets.beta },
      },
      pending: rail.pending.slice(),
      secrets: rail.secrets.slice(),
      tape: rail.tape.slice(),
    },
    id,
  };
}

function memoOf(raw: string): string | null {
  const memo = raw.trim().replace(/\s+/g, " ");
  if (memo.length < 2 || memo.length > 96) return null;
  return memo;
}

function dollars(n: number, max: number): number | null {
  if (!Number.isFinite(n)) return null;
  const v = Math.round(n * 100) / 100;
  if (v < MIN || v > max) return null;
  return v;
}

function bank(id: Desk): boolean {
  return id === "alpha" || id === "beta";
}

function put(rail: Rail, line: Line, secret?: Secret): Rail {
  return {
    ...rail,
    secrets: secret ? [...rail.secrets, secret] : rail.secrets,
    tape: [...rail.tape, line],
  };
}

export function issue(rail: Rail, to: Desk, usd: number, memo: string, rng: Rng = randomBlind): Result {
  if (!bank(to)) return fail("The issuer funds a bank, not itself.");
  const amount = dollars(usd, FLOAT);
  if (amount == null) return fail("Funding is $1 to $5,000,000.");
  const note = memoOf(memo);
  if (!note) return fail("A memo is required. Two to ninety-six characters.");
  if (rail.buckets.anchorage.pub < amount) return fail("The issuer treasury does not have that much public ZLUSD.");
  const blind = rng();
  const hash = commitment(amount, blind);
  const stepped = next(rail);
  const copy = stepped.rail;
  copy.buckets.anchorage = { ...copy.buckets.anchorage, pub: round(copy.buckets.anchorage.pub - amount) };
  copy.buckets[to] = { ...copy.buckets[to], pub: round(copy.buckets[to].pub + amount) };
  return {
    ok: true,
    rail: put(copy, row(stepped.id, "issue", "anchorage", to, hash, "", note, amount), { id: stepped.id, usd: amount, blind, commitment: hash }),
  };
}

export function shield(rail: Rail, desk: Desk, usd: number, memo: string, rng: Rng = randomBlind): Result {
  if (!bank(desk)) return fail("The issuer treasury stays public.");
  if (rail.buckets[desk].frozen) return fail("This bank is frozen. Public dollars stay where they are.");
  const amount = dollars(usd, MAX_HIDDEN);
  if (amount == null) return fail("A confidential move is $1 to $2,500,000.");
  const note = memoOf(memo);
  if (!note) return fail("A memo is required. Two to ninety-six characters.");
  if (rail.buckets[desk].pub < amount) return fail("The public balance is short.");
  const blind = rng();
  const hash = commitment(amount, blind);
  const stepped = next(rail);
  const copy = stepped.rail;
  const bucket = copy.buckets[desk];
  copy.buckets[desk] = { ...bucket, pub: round(bucket.pub - amount), conf: round(bucket.conf + amount) };
  return {
    ok: true,
    rail: put(copy, row(stepped.id, "shield", desk, desk, hash, "", note, amount), { id: stepped.id, usd: amount, blind, commitment: hash }),
  };
}

export function send(rail: Rail, from: Desk, usd: number, purpose: Purpose, memo: string, rng: Rng = randomBlind): Result {
  if (!bank(from)) return fail("Only a bank sends a hidden amount.");
  const to: Desk = from === "alpha" ? "beta" : "alpha";
  if (rail.buckets[from].frozen) return fail("This bank is frozen. The hidden balance cannot move.");
  if (purpose !== "settlement" && purpose !== "remit-in") return fail("Pick a purpose.");
  const amount = dollars(usd, MAX_HIDDEN);
  if (amount == null) return fail("A confidential send is $1 to $2,500,000.");
  const note = memoOf(memo);
  if (!note) return fail("A memo is required. Two to ninety-six characters.");
  if (rail.buckets[from].conf < amount) return fail("The confidential balance is short. Make confidential first. The public account cannot hide an amount.");
  const blind = rng();
  const hash = commitment(amount, blind);
  const stepped = next(rail);
  const copy = stepped.rail;
  const bucket = copy.buckets[from];
  copy.buckets[from] = { ...bucket, conf: round(bucket.conf - amount) };
  const pending: Pending = { id: stepped.id, usd: amount, blind, commitment: hash, from, to, purpose, memo: note, at: Date.now() };
  copy.pending = [...copy.pending, pending];
  return {
    ok: true,
    rail: put(copy, row(stepped.id, "send", from, to, hash, purpose, note, null), { id: stepped.id, usd: amount, blind, commitment: hash }),
  };
}

export function accept(rail: Rail, id: string, as: Desk): Result {
  const item = rail.pending.find((row) => row.id === id);
  if (!item) return fail("That settlement is not waiting.");
  if (as !== item.to) return fail("Only the receiving bank can accept. The sender cannot accept its own send.");
  if (!openingHolds(item.usd, item.blind, item.commitment)) return fail("The opening does not match the commitment. Refused.");
  if (rail.buckets[as].frozen) return fail("This bank is frozen. The settlement stays pending until the issuer thaws it.");
  const stepped = next(rail);
  const copy = stepped.rail;
  const bucket = copy.buckets[as];
  copy.buckets[as] = { ...bucket, conf: round(bucket.conf + item.usd) };
  copy.pending = copy.pending.filter((row) => row.id !== id);
  return {
    ok: true,
    rail: put(
      copy,
      row(stepped.id, "accept", item.from, as, item.commitment, item.purpose, item.memo, null),
      { id: stepped.id, usd: item.usd, blind: item.blind, commitment: item.commitment },
    ),
  };
}

export function reveal(rail: Rail, desk: Desk, usd: number, memo: string, rng: Rng = randomBlind): Result {
  if (!bank(desk)) return fail("The issuer has no confidential balance.");
  if (rail.buckets[desk].frozen) return fail("This bank is frozen. Hidden dollars stay hidden.");
  const amount = dollars(usd, MAX_HIDDEN);
  if (amount == null) return fail("Making public is $1 to $2,500,000.");
  const note = memoOf(memo);
  if (!note) return fail("A memo is required. Two to ninety-six characters.");
  if (rail.buckets[desk].conf < amount) return fail("The confidential balance is short.");
  const blind = rng();
  const hash = commitment(amount, blind);
  const stepped = next(rail);
  const copy = stepped.rail;
  const bucket = copy.buckets[desk];
  copy.buckets[desk] = { ...bucket, conf: round(bucket.conf - amount), pub: round(bucket.pub + amount) };
  return {
    ok: true,
    rail: put(copy, row(stepped.id, "reveal", desk, desk, hash, "", note, amount), { id: stepped.id, usd: amount, blind, commitment: hash }),
  };
}

export function returnPublic(rail: Rail, desk: Desk, usd: number, memo: string, rng: Rng = randomBlind): Result {
  if (!bank(desk)) return fail("The treasury does not return to itself.");
  if (rail.buckets[desk].frozen) return fail("This bank is frozen. Public dollars stay until the issuer takes them or thaws the bank.");
  const amount = dollars(usd, MAX_HIDDEN);
  if (amount == null) return fail("A return is $1 to $2,500,000.");
  const note = memoOf(memo);
  if (!note) return fail("A memo is required. Two to ninety-six characters.");
  if (rail.buckets[desk].pub < amount) return fail("The public balance is short. Confidential ZLUSD has to be made public first.");
  const blind = rng();
  const hash = commitment(amount, blind);
  const stepped = next(rail);
  const copy = stepped.rail;
  copy.buckets[desk] = { ...copy.buckets[desk], pub: round(copy.buckets[desk].pub - amount) };
  copy.buckets.anchorage = { ...copy.buckets.anchorage, pub: round(copy.buckets.anchorage.pub + amount) };
  return {
    ok: true,
    rail: put(copy, row(stepped.id, "return", desk, "anchorage", hash, "", note, amount), { id: stepped.id, usd: amount, blind, commitment: hash }),
  };
}

export function freeze(rail: Rail, desk: Desk, memo: string): Result {
  if (!bank(desk)) return fail("The issuer treasury is not a bank account.");
  if (rail.buckets[desk].frozen) return fail("That bank is already frozen.");
  const note = memoOf(memo);
  if (!note) return fail("A memo is required. Two to ninety-six characters.");
  const stepped = next(rail);
  const copy = stepped.rail;
  copy.buckets[desk] = { ...copy.buckets[desk], frozen: true };
  return { ok: true, rail: put(copy, row(stepped.id, "freeze", "anchorage", desk, "", "", note, null)) };
}

export function thaw(rail: Rail, desk: Desk, memo: string): Result {
  if (!bank(desk)) return fail("The issuer treasury is not a bank account.");
  if (!rail.buckets[desk].frozen) return fail("That bank is not frozen.");
  const note = memoOf(memo);
  if (!note) return fail("A memo is required. Two to ninety-six characters.");
  const stepped = next(rail);
  const copy = stepped.rail;
  copy.buckets[desk] = { ...copy.buckets[desk], frozen: false };
  return { ok: true, rail: put(copy, row(stepped.id, "thaw", "anchorage", desk, "", "", note, null)) };
}

/** Permanent-delegate analogue. Public dollars only. Confidential stays put. */
export function claw(rail: Rail, desk: Desk, usd: number, memo: string, rng: Rng = randomBlind): Result {
  if (!bank(desk)) return fail("Nothing to take from the treasury.");
  const amount = dollars(usd, FLOAT);
  if (amount == null) return fail("A claw is $1 to $5,000,000.");
  const note = memoOf(memo);
  if (!note) return fail("A memo is required. Two to ninety-six characters.");
  if (rail.buckets[desk].pub < amount) {
    return fail("The issuer can take the public balance only. Confidential ZLUSD stays with the bank until that bank makes it public.");
  }
  const blind = rng();
  const hash = commitment(amount, blind);
  const stepped = next(rail);
  const copy = stepped.rail;
  copy.buckets[desk] = { ...copy.buckets[desk], pub: round(copy.buckets[desk].pub - amount) };
  copy.buckets.anchorage = { ...copy.buckets.anchorage, pub: round(copy.buckets.anchorage.pub + amount) };
  return {
    ok: true,
    rail: put(copy, row(stepped.id, "claw", desk, "anchorage", hash, "", note, amount), { id: stepped.id, usd: amount, blind, commitment: hash }),
  };
}

/** The stage sequence. Leaves the $1.25M waiting for Bank Beta. */
export function stageBreakpoint(rail: Rail, rng: Rng = randomBlind): Result {
  const funded = issue(rail, "alpha", FLOAT, "Anchorage funds Bank Alpha", rng);
  if (!funded.ok) return funded;
  const shielded = shield(funded.rail, "alpha", 2_000_000, "Bank Alpha makes a confidential balance", rng);
  if (!shielded.ok) return shielded;
  return send(shielded.rail, "alpha", 1_250_000, "settlement", "Interbank settlement", rng);
}

function seesHidden(lens: Lens, parties: Desk[]): boolean {
  if (lens === "zelle") return true;
  if (lens === "alpha" || lens === "beta") return parties.includes(lens);
  return false;
}

export function view(rail: Rail, lens: Lens): RailView {
  const secretById = new Map(rail.secrets.map((row) => [row.id, row]));
  return {
    lens,
    canMove: lens === "alpha" || lens === "beta" || lens === "anchorage",
    buckets: DESKS.map((desk) => {
      const bucket = rail.buckets[desk.id];
      const showConf = desk.id !== "anchorage" && (lens === desk.id || seesHidden(lens, [desk.id]));
      return {
        id: desk.id,
        name: desk.name,
        role: desk.role,
        pub: bucket.pub,
        conf: showConf ? bucket.conf : null,
        frozen: bucket.frozen,
      };
    }),
    pending: rail.pending.map((item) => ({
      id: item.id,
      from: item.from,
      to: item.to,
      purpose: item.purpose,
      memo: item.memo,
      at: item.at,
      commitment: item.commitment,
      usd: seesHidden(lens, [item.from, item.to]) && openingHolds(item.usd, item.blind, item.commitment) ? item.usd : null,
      canAccept: lens === item.to && !rail.buckets[item.to].frozen,
    })),
    tape: rail.tape.map((line) => {
      const secret = secretById.get(line.id);
      const hidden = line.publicUsd == null && (line.kind === "send" || line.kind === "accept");
      const broken = Boolean(secret) && !openingHolds(secret!.usd, secret!.blind, secret!.commitment);
      let usd: number | null = null;
      if (!hidden && line.publicUsd != null) usd = line.publicUsd;
      else if (hidden && secret && seesHidden(lens, [line.from, line.to]) && !broken) usd = secret.usd;
      return {
        id: line.id,
        at: line.at,
        kind: line.kind,
        from: line.from,
        to: line.to,
        purpose: line.purpose,
        memo: line.memo,
        commitment: line.commitment,
        usd,
        hidden,
        broken,
      };
    }),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function row(id: string, kind: Kind, from: Desk, to: Desk, hash: string, purpose: Purpose | "", memo: string, publicUsd: number | null): Line {
  return { id, at: Date.now(), kind, from, to, commitment: hash, purpose, memo, publicUsd };
}
