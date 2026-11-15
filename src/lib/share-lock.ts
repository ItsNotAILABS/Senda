/**
 * A PreStock lock this browser can liquidate.
 * The tokens move to a key stored here. If this tab is open and the print is
 * under the floor, that key sells through Jupiter and sends the USDC to the lender.
 * Close the tab and nothing liquidates. A lender cannot seize it from another computer.
 * This is not Kamino.
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import { requirePhantom, broadcastSigned, chainRpc as rpc, splHolding } from "@/lib/phantom";
import { Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { selfSwap, sendFromKey, sendUsdcFromKey, lamports } from "@/lib/self-swap";
import { USDC } from "@/lib/jup-exec";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const KP = "senda.sharelock.kp.v1";
const BOOK = "senda.sharelock.v1";

export type ShareLock = {
  mint: string;
  symbol: string;
  raw: string;
  decimals: number;
  lender: string;
  floor: number;
  at: number;
};

function key(): Keypair {
  if (typeof window === "undefined") throw new Error("A lock does not get a key in this browser.");
  const raw = window.localStorage.getItem(KP) || "";
  if (!raw) throw new Error("A lock does not get a key in this browser. The share stays in the wallet you sign with.");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

export function lockPubkey(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(KP) || "";
  if (!raw) return "";
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[])).publicKey.toBase58();
  } catch {
    return "";
  }
}

export function readLock(): ShareLock | null {
  if (typeof window === "undefined") return null;
  try {
    const row = JSON.parse(window.localStorage.getItem(BOOK) || "null") as ShareLock | null;
    return row && row.mint ? row : null;
  } catch {
    return null;
  }
}

function save(row: ShareLock | null) {
  if (!row) window.localStorage.removeItem(BOOK);
  else window.localStorage.setItem(BOOK, JSON.stringify(row));
}

async function programOf(mint: PublicKey): Promise<PublicKey> {
  const result = (await rpc("getAccountInfo", [mint.toBase58(), { encoding: "base64" }])) as { value?: { owner?: string } | null };
  return result?.value?.owner === TOKEN_2022.toBase58() ? TOKEN_2022 : TOKEN;
}

function ata(owner: PublicKey, mint: PublicKey, program: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), program.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}

/** Phantom sends the tokens into the lock. */
export async function lockShares(input: { owner: string; mint: string; symbol: string; ui: number; decimals: number; lender: string; floor: number }): Promise<string> {
  if (readLock()) throw new Error("A lock is already open. Unlock or let it pay the lender first.");
  if (!(input.ui > 0) || !(input.floor > 0)) throw new Error("Need a size and a floor price.");
  const owner = new PublicKey(input.owner);
  const mint = new PublicKey(input.mint);
  const program = await programOf(mint);
  const raw = BigInt(Math.round(input.ui * 10 ** input.decimals));
  const source = ata(owner, mint, program);
  const vault = key();
  const dest = ata(vault.publicKey, mint, program);
  const exists = (await rpc("getAccountInfo", [dest.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  const ix: TransactionInstruction[] = [];
  if (!exists?.value) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: owner, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: vault.publicKey, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: SYSTEM, isSigner: false, isWritable: false },
          { pubkey: program, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  const data = Buffer.alloc(9);
  data[0] = 3;
  data.writeBigUInt64LE(raw, 1);
  ix.push(
    new TransactionInstruction({
      programId: program,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data,
    }),
  );
  const hash = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  const tx = new Transaction({ feePayer: owner, recentBlockhash: hash.value.blockhash });
  tx.add(...ix);
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  const sig = await broadcastSigned(signed);
  save({ mint: input.mint, symbol: input.symbol, raw: raw.toString(), decimals: input.decimals, lender: input.lender, floor: input.floor, at: Date.now() });
  return sig;
}

/** If the print is under the floor, sell and pay the lender. Needs SOL on the lock address. */
export async function liquidateLock(price: number): Promise<string | null> {
  const row = readLock();
  if (!row || !(price > 0) || price > row.floor) return null;
  const kp = key();
  if ((await lamports(kp.publicKey.toBase58())) < 8_000) {
    throw new Error("Send about 0.01 SOL to the lock address. Then a print under the floor can sell without Phantom.");
  }
  const held = await splHolding(kp.publicKey.toBase58(), row.mint);
  const raw = Number(held.raw) > 0 ? Number(held.raw) : Number(row.raw);
  const sold = await selfSwap(kp, { inputMint: row.mint, outputMint: USDC, amountRaw: Math.floor(raw), maxImpact: 3 });
  const usdc = await splHolding(kp.publicKey.toBase58(), USDC);
  if (usdc.ui > 0.01) await sendUsdcFromKey(kp, row.lender, usdc.ui);
  save(null);
  return sold.signature;
}

export async function unlockShares(to: string): Promise<string> {
  const row = readLock();
  if (!row) throw new Error("Nothing is locked.");
  const kp = key();
  const sig = await sendFromKey(kp, {
    mint: new PublicKey(row.mint),
    to,
    raw: BigInt(row.raw),
    decimals: row.decimals,
  });
  save(null);
  return sig;
}
