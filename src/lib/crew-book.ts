/**
 * A crew contract is a payable. The brief and the notes live under senda.crew.v1,
 * which the seal encrypts once the wallet has opened it. Paying calls the same
 * USDC send the desk already uses on that network. Nothing here holds the money.
 */

import { PublicKey } from "@solana/web3.js";
import { sealOpen, unlockSeal } from "@/lib/seal";
import { payUsdc } from "@/lib/solana-pay";
import { payUsdcEvm, type EvmPayChain } from "@/lib/usdc-evm";
import { VENDORS } from "@/lib/vendors";

const KEY = "senda.crew.v1";

export const CREW_KINDS = ["invoice", "milestone", "bounty", "retainer", "grant"] as const;
export type CrewKind = (typeof CREW_KINDS)[number];

export const CREW_NETS = ["Solana", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism", "Avalanche", "BNB"] as const;
export type CrewNet = (typeof CREW_NETS)[number];

export type CrewNote = { at: number; from: "user" | "agent"; text: string };

export type CrewContract = {
  id: string;
  kind: CrewKind;
  title: string;
  brief: string;
  usd: number;
  payee: string;
  payer: string;
  net: CrewNet;
  venue: string;
  status: "open" | "paid" | "closed";
  draws: number;
  sig: string;
  notes: CrewNote[];
  at: number;
};

const VENUES = new Set(VENDORS.map((row) => row.name));

function read(): CrewContract[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as CrewContract[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function write(rows: CrewContract[]) {
  if (!sealOpen()) throw new Error("Unlock the crew first. The brief is not stored in the clear.");
  window.localStorage.setItem(KEY, JSON.stringify(rows));
}

export function listCrew(): CrewContract[] {
  return read().sort((a, b) => b.at - a.at);
}

export async function openCrewSeal(owner: string): Promise<void> {
  await unlockSeal(owner);
  if (!sealOpen()) throw new Error("The wallet did not open the seal.");
}

function payeeOk(net: CrewNet, payee: string): string {
  const text = payee.trim();
  if (net === "Solana") {
    try {
      return new PublicKey(text).toBase58();
    } catch {
      throw new Error("That is not a Solana address.");
    }
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(text)) throw new Error(`That is not an address on ${net}.`);
  return text;
}

export function fileCrew(input: {
  payer: string;
  kind: CrewKind;
  title: string;
  brief: string;
  usd: number;
  payee: string;
  net: CrewNet;
  venue: string;
}): CrewContract {
  if (!CREW_KINDS.includes(input.kind)) throw new Error("That contract is not on this desk.");
  if (!CREW_NETS.includes(input.net)) throw new Error("That network cannot pay from this desk.");
  const title = input.title.trim();
  const brief = input.brief.trim();
  const venue = input.venue.trim();
  if (!title) throw new Error("Name the contract.");
  if (!brief) throw new Error("Say what done looks like.");
  if (!VENUES.has(venue)) throw new Error("Pick a venue this desk already uses.");
  if (!(input.usd >= 1)) throw new Error("The smallest payable is 1 USDC.");
  const usd = Math.round(input.usd * 100) / 100;
  if (input.net !== "Solana" && usd > 5000) throw new Error("That network pays up to 5,000 USDC in one signature.");
  const payer = input.payer.trim();
  if (payer.length < 32) throw new Error("Connect the wallet that will pay.");
  const payee = input.kind === "bounty" && !input.payee.trim() ? "" : payeeOk(input.net, input.payee);
  const row: CrewContract = {
    id: `${Date.now()}`,
    kind: input.kind,
    title,
    brief,
    usd,
    payee,
    payer,
    net: input.net,
    venue,
    status: "open",
    draws: 0,
    sig: "",
    notes: [],
    at: Date.now(),
  };
  write([row, ...read()]);
  return row;
}

export function noteCrew(id: string, from: "user" | "agent", text: string): CrewContract {
  const line = text.trim();
  if (!line) throw new Error("Write the note.");
  if (line.length > 500) throw new Error("Keep the note under 500 characters.");
  const rows = read();
  const row = rows.find((item) => item.id === id);
  if (!row || row.status === "closed") throw new Error("That contract is closed.");
  row.notes = [...row.notes, { at: Date.now(), from, text: line }];
  write(rows);
  return row;
}

export function claimCrew(id: string, payee: string): CrewContract {
  const rows = read();
  const row = rows.find((item) => item.id === id);
  if (!row || row.kind !== "bounty" || row.status !== "open") throw new Error("That bounty is not open.");
  row.payee = payeeOk(row.net, payee);
  write(rows);
  return row;
}

export function closeCrew(id: string, payer: string): void {
  const rows = read();
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error("That contract is not on this desk.");
  if (row.payer !== payer) throw new Error("Only the payer closes it.");
  if (row.status === "paid") throw new Error("It is already paid.");
  row.status = "closed";
  write(rows);
}

/** The wallet signs USDC on the network named on the contract. A retainer can be drawn again. */
export async function payCrew(id: string, payer: string): Promise<string> {
  const rows = read();
  const row = rows.find((item) => item.id === id);
  if (!row || row.status === "closed") throw new Error("That contract is not open.");
  if (row.payer !== payer) throw new Error("Only the payer signs this.");
  if (row.status === "paid" && row.kind !== "retainer") throw new Error("Already paid.");
  if (!row.payee) throw new Error("A bounty needs an address before it pays.");
  const memo = `crew ${row.kind} ${row.venue} ${row.title}`;
  const sig =
    row.net === "Solana"
      ? (await payUsdc({ owner: payer, to: row.payee, usd: row.usd, memo, deskFee: false })).signature
      : await payUsdcEvm(row.net as EvmPayChain, row.payee, row.usd);
  row.sig = sig;
  row.draws += 1;
  if (row.kind !== "retainer") row.status = "paid";
  row.notes = [...row.notes, { at: Date.now(), from: "user", text: `Paid ${row.usd} USDC on ${row.net}. ${sig}` }];
  write(rows);
  return sig;
}
