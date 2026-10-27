/**
 * A job is a USDC transfer. The amount leaves Phantom into a work account.
 * The key for that account stays in this browser. Release pays the worker.
 * Cancel pays the poster back. There is no Senda program, and Senda does not
 * invent a payout the account does not hold.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { transferData } from "@/lib/chain-codec";
import { requirePhantom, broadcastSigned, chainRpc as rpc, splHolding } from "@/lib/phantom";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const JOBS = "senda.work.jobs.v1";
const KP = "senda.work.kp.v1";

export type WorkJob = {
  id: string;
  sig: string;
  title: string;
  brief: string;
  usd: number;
  poster: string;
  worker: string;
  status: "open" | "released" | "cancelled";
  at: number;
};

function ata(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN.toBuffer(), USDC_MINT.toBuffer()],
    ATA_PROGRAM,
  )[0];
}

function workKey(): Keypair {
  if (typeof window === "undefined") throw new Error("A job does not get a key in this browser.");
  const raw = window.localStorage.getItem(KP) || "";
  if (!raw) throw new Error("A job does not get a key in this browser. The USDC leaves the wallet you sign with.");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

export function listJobs(): WorkJob[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(JOBS) || "[]") as WorkJob[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: WorkJob[]) {
  window.localStorage.setItem(JOBS, JSON.stringify(rows));
}

function solAddress(raw: string, what: string): PublicKey {
  const text = raw.trim();
  if (text.length < 32 || text.length > 44) throw new Error(`${what} must be a Solana address.`);
  try {
    return new PublicKey(text);
  } catch {
    throw new Error(`${what} must be a Solana address.`);
  }
}

async function blockhash(): Promise<string> {
  const result = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  const hash = result?.value?.blockhash;
  if (!hash) throw new Error("No blockhash.");
  return hash;
}

async function accountExists(address: PublicKey): Promise<boolean> {
  const result = (await rpc("getAccountInfo", [address.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  return Boolean(result?.value);
}

function atoms(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

export async function workUsdc(): Promise<number> {
  if (typeof window === "undefined") return 0;
  const held = await splHolding(workKey().publicKey.toBase58(), USDC_MINT.toBase58());
  return held.ui;
}

/** Move USDC from Phantom into the work account and keep the job open. */
export async function fundJob(input: {
  owner: string;
  title: string;
  brief: string;
  usd: number;
  worker: string;
}): Promise<WorkJob> {
  const title = input.title.trim();
  const brief = input.brief.trim();
  if (!title) throw new Error("Name the job.");
  if (!brief) throw new Error("Say what done looks like.");
  if (!Number.isFinite(input.usd)) throw new Error("The smallest job is 1 USDC.");
  const usd = Math.round(input.usd * 1_000_000) / 1_000_000;
  if (usd < 1) throw new Error("The smallest job is 1 USDC.");
  const owner = solAddress(input.owner, "The wallet");
  const worker = solAddress(input.worker, "The worker");
  const vault = workKey();
  const source = ata(owner);
  const dest = ata(vault.publicKey);
  if (!(await accountExists(source))) throw new Error("This wallet has no USDC account.");
  const posterHeld = await splHolding(owner.toBase58(), USDC_MINT.toBase58());
  const raw = atoms(usd);
  if (BigInt(posterHeld.raw || "0") < raw) throw new Error("This wallet does not hold that much USDC.");
  const ix: TransactionInstruction[] = [];
  if (!(await accountExists(dest))) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: owner, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: vault.publicKey, isSigner: false, isWritable: false },
          { pubkey: USDC_MINT, isSigner: false, isWritable: false },
          { pubkey: SYSTEM, isSigner: false, isWritable: false },
          { pubkey: TOKEN, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  ix.push(
    new TransactionInstruction({
      programId: TOKEN,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(transferData(raw)),
    }),
  );
  ix.push(
    new TransactionInstruction({
      programId: MEMO,
      keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
      data: Buffer.from(new TextEncoder().encode(`Senda work ${title}`)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  const sig = await broadcastSigned(signed);
  const row: WorkJob = {
    id: sig,
    sig,
    title,
    brief,
    usd,
    poster: owner.toBase58(),
    worker: worker.toBase58(),
    status: "open",
    at: Date.now(),
  };
  save([row, ...listJobs()]);
  return row;
}

function openJob(job: WorkJob): WorkJob {
  const current = listJobs().find((j) => j.id === job.id);
  if (!current || current.status !== "open") throw new Error("That job is already closed.");
  return current;
}

function onlyPoster(job: WorkJob, owner: string, verb: "release" | "cancel"): PublicKey {
  const poster = solAddress(job.poster, "The poster");
  const caller = solAddress(owner, "The wallet");
  if (!poster.equals(caller)) throw new Error(`Only the poster can ${verb} this job.`);
  return caller;
}

/** Send this job's USDC from the work account to `to`. Phantom pays the fee. */
async function payOut(feePayer: PublicKey, to: PublicKey, usd: number): Promise<string> {
  const vault = workKey();
  const source = ata(vault.publicKey);
  const dest = ata(to);
  const raw = atoms(usd);
  if (raw <= 0n) throw new Error("That job has no USDC to send.");
  const held = await splHolding(vault.publicKey.toBase58(), USDC_MINT.toBase58());
  if (BigInt(held.raw || "0") < raw) {
    throw new Error(`The work account holds ${held.ui} USDC. This job needs ${usd}.`);
  }
  const ix: TransactionInstruction[] = [];
  if (!(await accountExists(dest))) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: feePayer, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: to, isSigner: false, isWritable: false },
          { pubkey: USDC_MINT, isSigner: false, isWritable: false },
          { pubkey: SYSTEM, isSigner: false, isWritable: false },
          { pubkey: TOKEN, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  ix.push(
    new TransactionInstruction({
      programId: TOKEN,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: vault.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(transferData(raw)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = feePayer;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  tx.partialSign(vault);
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}

function mark(id: string, status: "released" | "cancelled") {
  save(listJobs().map((j) => (j.id === id ? { ...j, status } : j)));
}

/** Only the poster. Sends this job's USDC to the worker. */
export async function releaseJob(job: WorkJob, owner: string): Promise<string> {
  const current = openJob(job);
  const caller = onlyPoster(current, owner, "release");
  const worker = solAddress(current.worker, "The worker");
  const sig = await payOut(caller, worker, current.usd);
  mark(current.id, "released");
  return sig;
}

/** Sends this job's USDC back to the poster. */
export async function cancelJob(job: WorkJob, owner: string): Promise<string> {
  const current = openJob(job);
  const caller = onlyPoster(current, owner, "cancel");
  const sig = await payOut(caller, caller, current.usd);
  mark(current.id, "cancelled");
  return sig;
}
