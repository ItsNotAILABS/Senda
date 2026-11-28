/**
 * A software agent on Solana devnet.
 * The secret is sealed with PBKDF2-SHA256 and AES-GCM before it touches storage.
 * The server never sees it. This key cannot spend mainnet USDC.
 */

import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { openBytes, sealBytes } from "@/lib/private-box";

const RPC = "https://api.devnet.solana.com";
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const STORE = "senda.devnet-agents.v1";

export type SealedAgent = {
  id: string;
  name: string;
  pubkey: string;
  salt: string;
  iv: string;
  box: string;
  kdf: "PBKDF2-SHA256-250000";
  cipher: "AES-GCM-256";
  cluster: "devnet";
  at: number;
};

function read(): SealedAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(STORE) || "[]") as SealedAgent[];
    return Array.isArray(rows) ? rows.filter((row) => row && row.cluster === "devnet" && row.cipher === "AES-GCM-256") : [];
  } catch {
    return [];
  }
}

function write(rows: SealedAgent[]) {
  window.localStorage.setItem(STORE, JSON.stringify(rows.slice(0, 12)));
}

/** web3.js returns a copy from the getter. The live scalar sits on the internal key. */
function wipe(pair: Keypair) {
  const bag = (pair as unknown as { _keypair?: { secretKey?: Uint8Array } })._keypair;
  bag?.secretKey?.fill(0);
}

export function listAgents(): SealedAgent[] {
  return read();
}

export function dropAgent(id: string) {
  write(read().filter((row) => row.id !== id));
}

export async function sealAgent(name: string, passphrase: string): Promise<SealedAgent> {
  const clean = name.trim().slice(0, 32);
  if (clean.length < 2) throw new Error("Name the agent.");
  const pair = Keypair.generate();
  try {
    const sealed = await sealBytes(pair.secretKey, passphrase);
    const row: SealedAgent = {
      id: crypto.randomUUID(),
      name: clean,
      pubkey: pair.publicKey.toBase58(),
      salt: sealed.salt,
      iv: sealed.iv,
      box: sealed.box,
      kdf: "PBKDF2-SHA256-250000",
      cipher: "AES-GCM-256",
      cluster: "devnet",
      at: Date.now(),
    };
    write([row, ...read()]);
    return row;
  } finally {
    wipe(pair);
  }
}

async function unlock(row: SealedAgent, passphrase: string): Promise<Keypair> {
  const secret = await openBytes(row, passphrase);
  const owned = new Uint8Array(secret);
  secret.fill(0);
  if (owned.length !== 64) {
    owned.fill(0);
    throw new Error("The sealed key is the wrong length.");
  }
  let pair: Keypair;
  try {
    pair = Keypair.fromSecretKey(owned);
  } catch {
    owned.fill(0);
    throw new Error("The sealed key is not a Solana key.");
  }
  if (pair.publicKey.toBase58() !== row.pubkey) {
    wipe(pair);
    throw new Error("The sealed key does not match this address.");
  }
  return pair;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  });
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "Devnet refused.");
  if (body.result === undefined) throw new Error("Devnet returned nothing.");
  return body.result;
}

export async function devnetLamports(pubkey: string): Promise<number> {
  const result = await rpc<{ value: number }>("getBalance", [pubkey, { commitment: "confirmed" }]);
  const value = Number(result.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("Devnet did not return a balance.");
  return value;
}

export function solOf(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

/** Devnet faucet. Fails in the open when the faucet is capped. Does not touch mainnet. */
export async function devnetAirdrop(pubkey: string): Promise<string> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pubkey)) throw new Error("That is not a Solana address.");
  return rpc<string>("requestAirdrop", [pubkey, 1_000_000_000]);
}

/** The agent signs a memo on devnet and pays the fee from its own devnet SOL. */
export async function devnetMemo(row: SealedAgent, passphrase: string, text: string): Promise<string> {
  const memo = text.trim().slice(0, 180);
  if (memo.length < 2) throw new Error("Write what this agent is attesting.");
  const pair = await unlock(row, passphrase);
  try {
    const blockhash = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
    const hash = blockhash.value?.blockhash;
    if (!hash) throw new Error("Devnet did not return a blockhash.");
    const tx = new Transaction();
    tx.feePayer = pair.publicKey;
    tx.recentBlockhash = hash;
    tx.add(
      new TransactionInstruction({
        programId: MEMO,
        keys: [{ pubkey: pair.publicKey, isSigner: true, isWritable: false }],
        data: new TextEncoder().encode(`Senda agent ${memo}`),
      }),
    );
    tx.sign(pair);
    const raw = tx.serialize();
    let wire = "";
    for (const byte of raw) wire += String.fromCharCode(byte);
    return rpc<string>("sendTransaction", [btoa(wire), { encoding: "base64", preflightCommitment: "confirmed" }]);
  } finally {
    wipe(pair);
  }
}
