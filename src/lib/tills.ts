/** Desk wallets. The secret is sealed to the Phantom that spun the wallet up. The app does not know the Phantom key. */

import { Buffer } from "buffer";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { broadcastSigned, chainRpc, requirePhantom } from "@/lib/phantom";

const KEY = "senda.tills.v1";
const EVENT = "senda-tills";
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export type TillReason = "cover" | "work" | "till" | "agent" | "gift";

export const TILL_REASONS: { id: TillReason; label: string; line: string }[] = [
  { id: "cover", label: "Cover", line: "A premium sits here until the book pays it back." },
  { id: "work", label: "Work", line: "A job’s USDC sits here until the work is done." },
  { id: "till", label: "Till", line: "A counter takes a payment without touching the main Phantom." },
  { id: "agent", label: "Agent", line: "A purse an agent spends from, separate from the main wallet." },
  { id: "gift", label: "Gift", line: "You fund it, then hand the address to someone." },
];

export type Till = {
  id: string;
  name: string;
  reason: TillReason;
  address: string;
  secret: string;
  created: number;
};

function unpack(secret: string): Uint8Array {
  return new Uint8Array(Buffer.from(secret, "base64"));
}

export function listTills(): Till[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is Till => {
      if (!row || typeof row !== "object") return false;
      const t = row as Till;
      return typeof t.address === "string" && typeof t.secret === "string" && typeof t.reason === "string";
    });
  } catch {
    return [];
  }
}

function save(rows: Till[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(EVENT));
}

function ata(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN.toBytes(), USDC.toBytes()], ATA)[0];
}

function keypair(row: Till): Keypair {
  return Keypair.fromSecretKey(unpack(row.secret));
}

/** New tills are not minted. An old one can still be swept back to Phantom. */
export async function spinTill(owner: string, reason: TillReason, name?: string): Promise<Till> {
  void owner;
  void reason;
  void name;
  throw new Error("A till does not get a key in this browser. Sweep an old one if it still holds USDC. New payments leave Phantom.");
}

export async function tillUsdc(address: string): Promise<number> {
  const account = ata(new PublicKey(address)).toBase58();
  const result = (await chainRpc("getTokenAccountBalance", [account])) as { value?: { uiAmount?: number } } | null;
  return Number(result?.value?.uiAmount) || 0;
}

/** USDC leaves the desk wallet and lands on the Phantom. Phantom pays the fee. Both sign. */
export async function sweepTill(id: string, phantom: string): Promise<string> {
  const row = listTills().find((t) => t.id === id);
  if (!row) throw new Error("That wallet is not on this desk.");
  const from = keypair(row);
  const owner = new PublicKey(phantom);
  const source = ata(from.publicKey);
  const dest = ata(owner);
  const have = (await chainRpc("getTokenAccountBalance", [source.toBase58()])) as { value?: { amount?: string } } | null;
  const raw = BigInt(have?.value?.amount || "0");
  if (raw <= 0n) throw new Error("Nothing in this wallet.");
  const destInfo = (await chainRpc("getAccountInfo", [dest.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  const ix: TransactionInstruction[] = [];
  if (!destInfo?.value) {
    ix.push(
      new TransactionInstruction({
        programId: ATA,
        keys: [
          { pubkey: owner, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: owner, isSigner: false, isWritable: false },
          { pubkey: USDC, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0);
  data.writeBigUInt64LE(raw, 1);
  ix.push(
    new TransactionInstruction({
      programId: TOKEN,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: from.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    }),
  );
  const hash = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  const tx = new Transaction({ feePayer: owner, recentBlockhash: hash.value.blockhash });
  tx.add(...ix);
  tx.partialSign(from);
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}

export function onTills(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
