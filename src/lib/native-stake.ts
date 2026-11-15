/** Delegate SOL to a validator from this app. The wallet signs. Senda does not hold the stake account. */

import { Authorized, Keypair, Lockup, PublicKey, StakeProgram, Transaction } from "@solana/web3.js";
import { chainRpc, sendPartial } from "@/lib/phantom";

export const VALIDATORS = [
  { name: "Helius", vote: "he1iusunGwqrNtafDtLdhsUQDFvo13z9sUa36PauBtk" },
  { name: "Jupiter", vote: "CatzoSMUkTRidT5DwBxAC2pEtnwMBTpkCepHkFgZDiqb" },
  { name: "Figment", vote: "CcaHc2L43ZWjwCHART3oZoJvHLAe9hzT2DJNUpBzoTN1" },
  { name: "Binance", vote: "3N7s9zXMZ4QqvHQR15t5GNHyqc89KduzMP7423eWiD5g" },
] as const;

const KEY = "senda.stakeacct.v1";

export type StakeAcct = { stake: string; vote: string; name: string; sol: number; at: number };

function read(): StakeAcct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as StakeAcct[];
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.stake === "string") : [];
  } catch {
    return [];
  }
}

export function listStakeAccounts(): StakeAcct[] {
  return read();
}

function remember(row: StakeAcct): void {
  const next = [row, ...read().filter((r) => r.stake !== row.stake)].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(next));
}

async function blockhash(): Promise<string> {
  const body = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  const hash = body?.value?.blockhash;
  if (!hash) throw new Error("No blockhash.");
  return hash;
}

async function rent(): Promise<number> {
  const n = (await chainRpc("getMinimumBalanceForRentExemption", [200])) as number;
  if (!(n > 0)) throw new Error("Could not read the stake rent.");
  return n;
}

/** Creates a stake account the wallet owns and delegates it. Rent is added on top of the SOL. */
export async function delegateSol(owner: string, vote: string, name: string, sol: number): Promise<string> {
  if (!(sol >= 0.01)) throw new Error("Stake at least 0.01 SOL.");
  const from = new PublicKey(owner);
  const voteKey = new PublicKey(vote);
  const stake = Keypair.generate();
  const lamports = Math.round(sol * 1e9) + (await rent());
  const tx = new Transaction().add(
    StakeProgram.createAccount({
      fromPubkey: from,
      stakePubkey: stake.publicKey,
      authorized: new Authorized(from, from),
      lockup: new Lockup(0, 0, from),
      lamports,
    }),
    StakeProgram.delegate({
      stakePubkey: stake.publicKey,
      authorizedPubkey: from,
      votePubkey: voteKey,
    }),
  );
  tx.feePayer = from;
  tx.recentBlockhash = await blockhash();
  tx.partialSign(stake);
  const sig = await sendPartial(tx);
  remember({ stake: stake.publicKey.toBase58(), vote, name, sol, at: Date.now() });
  return sig;
}

/** Stops the delegation. The SOL stays in the stake account until the epoch lets you withdraw it. */
export async function deactivateStake(owner: string, stake: string): Promise<string> {
  const from = new PublicKey(owner);
  const tx = new Transaction().add(
    StakeProgram.deactivate({
      stakePubkey: new PublicKey(stake),
      authorizedPubkey: from,
    }),
  );
  tx.feePayer = from;
  tx.recentBlockhash = await blockhash();
  return sendPartial(tx);
}
