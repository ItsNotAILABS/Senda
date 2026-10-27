/**
 * One trading agent. The key stays in this browser.
 * Fund the address with USDC and a little SOL. Arming spends that address, not Phantom.
 */

import { Keypair } from "@solana/web3.js";
import { USDC } from "@/lib/jup-exec";
import { splHolding } from "@/lib/phantom";
import { lamports, sendUsdcFromKey } from "@/lib/self-swap";

const KP = "senda.agent.live.kp.v1";
const POS = "senda.agent.live.pos.v1";
const LOG = "senda.agent.live.log.v1";

export type LivePos = {
  mint: string;
  symbol: string;
  entry: number;
  usd: number;
  raw: string;
  decimals: number;
  at: number;
  sig: string;
};

export type LiveNote = { at: number; text: string };

function key(): Keypair {
  if (typeof window === "undefined") throw new Error("The agent does not hold a key.");
  const raw = window.localStorage.getItem(KP) || "";
  if (!raw) throw new Error("The agent does not hold a key. Queue the trade and sign it in Phantom.");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

export function agentPubkey(): string {
  if (typeof window === "undefined") return "";
  try {
    return key().publicKey.toBase58();
  } catch {
    return "";
  }
}

export function livePosition(): LivePos | null {
  if (typeof window === "undefined") return null;
  try {
    const row = JSON.parse(window.localStorage.getItem(POS) || "null") as LivePos | null;
    return row && row.mint ? row : null;
  } catch {
    return null;
  }
}

function savePos(row: LivePos | null) {
  if (!row) window.localStorage.removeItem(POS);
  else window.localStorage.setItem(POS, JSON.stringify(row));
}

export function liveNotes(): LiveNote[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(LOG) || "[]") as LiveNote[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function note(text: string) {
  const rows = [{ at: Date.now(), text }, ...liveNotes()].slice(0, 24);
  window.localStorage.setItem(LOG, JSON.stringify(rows));
}

export async function agentBalances(): Promise<{ usdc: number; sol: number }> {
  const owner = agentPubkey();
  if (!owner) return { usdc: 0, sol: 0 };
  const [usdc, sol] = await Promise.all([
    splHolding(owner, USDC).then((h) => h.ui).catch(() => 0),
    lamports(owner).then((n) => n / 1e9).catch(() => 0),
  ]);
  return { usdc, sol };
}

/** The agent does not sign. An old address, if one was already funded, can still be withdrawn. */
export async function agentPass(): Promise<string> {
  throw new Error("The agent can queue a trade. It cannot sign one. Open the ticket and sign in Phantom.");
}

export async function agentWithdraw(to: string, usd: number): Promise<string> {
  if (livePosition()) throw new Error("Sell the open token first. A withdraw does not close it.");
  const sig = await sendUsdcFromKey(key(), to, usd);
  note(`Withdrew $${usd.toFixed(2)}. ${sig.slice(0, 8)}`);
  return sig;
}
