/** Token accounts of the connected Phantom. The app does not hold these keys. */

import { Buffer } from "buffer";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { broadcastSigned, chainRpc, requirePhantom } from "@/lib/phantom";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = new PublicKey("11111111111111111111111111111111");

export type Attached = {
  id: string;
  symbol: string;
  mint: string;
  line: string;
};

export const ATTACHED: Attached[] = [
  { id: "sol", symbol: "SOL", mint: "", line: "The Phantom address itself. SOL lands here." },
  { id: "usdc", symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", line: "Dollars. Send, Bitso, and shop pay from here. Paste this into a third-party app that asks for USDC." },
  { id: "usdt", symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", line: "Tether. Some desks take this when they do not take USDC." },
  { id: "pyusd", symbol: "PYUSD", mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", line: "PayPal’s dollar. An app that asks for PYUSD pays this line." },
  { id: "mxne", symbol: "MXNe", mint: "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa", line: "Pesos. Only this Phantom can spend them." },
  { id: "eurc", symbol: "EURC", mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", line: "Euros. Only this Phantom can spend them." },
  { id: "jito", symbol: "JitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", line: "Staked SOL. It earns while it sits. It is not the SOL line." },
];

/** The account Phantom already owns for this mint. */
export function attachedAddress(owner: string, row: Attached): string {
  if (!row.mint) return owner;
  return PublicKey.findProgramAddressSync(
    [new PublicKey(owner).toBytes(), TOKEN.toBytes(), new PublicKey(row.mint).toBytes()],
    ATA,
  )[0].toBase58();
}

export async function accountOpen(address: string): Promise<boolean> {
  const result = (await chainRpc("getAccountInfo", [address, { encoding: "base64" }])) as { value?: unknown };
  return Boolean(result?.value);
}

/** Phantom signs one account. Already-open accounts are left alone. */
export async function openOne(owner: string, mint: string): Promise<string | null> {
  const row = ATTACHED.find((item) => item.mint === mint);
  if (!row) throw new Error("That account is not on this Phantom.");
  const who = new PublicKey(owner);
  const tokenMint = new PublicKey(mint);
  const dest = PublicKey.findProgramAddressSync([who.toBytes(), TOKEN.toBytes(), tokenMint.toBytes()], ATA)[0];
  const have = (await chainRpc("getAccountInfo", [dest.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  if (have?.value) return null;
  const tx = new Transaction();
  tx.feePayer = who;
  const hash = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  tx.recentBlockhash = hash.value.blockhash;
  tx.add(
    new TransactionInstruction({
      programId: ATA,
      keys: [
        { pubkey: who, isSigner: true, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: who, isSigner: false, isWritable: false },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: SYSTEM, isSigner: false, isWritable: false },
        { pubkey: TOKEN, isSigner: false, isWritable: false },
      ],
      data: Buffer.alloc(0),
    }),
  );
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}

/** Phantom signs the create. The new account’s owner is that Phantom, not the app. */
export async function openAttached(owner: string, mint: string): Promise<string> {
  const signature = await openOne(owner, mint);
  if (!signature) throw new Error("That account is already open.");
  return signature;
}

/** Opens every missing account in one signature. Phantom pays the rent. The app keeps no key. */
export async function openMissing(owner: string): Promise<{ opened: string[]; signature: string | null }> {
  const who = new PublicKey(owner);
  const missing: { symbol: string; dest: PublicKey; mint: PublicKey }[] = [];
  for (const row of ATTACHED) {
    if (!row.mint) continue;
    const mint = new PublicKey(row.mint);
    const dest = PublicKey.findProgramAddressSync([who.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA)[0];
    const have = (await chainRpc("getAccountInfo", [dest.toBase58(), { encoding: "base64" }])) as { value?: unknown };
    if (!have?.value) missing.push({ symbol: row.symbol, dest, mint });
  }
  if (!missing.length) return { opened: [], signature: null };
  const tx = new Transaction();
  tx.feePayer = who;
  const hash = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  tx.recentBlockhash = hash.value.blockhash;
  for (const row of missing) {
    tx.add(
      new TransactionInstruction({
        programId: ATA,
        keys: [
          { pubkey: who, isSigner: true, isWritable: true },
          { pubkey: row.dest, isSigner: false, isWritable: true },
          { pubkey: who, isSigner: false, isWritable: false },
          { pubkey: row.mint, isSigner: false, isWritable: false },
          { pubkey: SYSTEM, isSigner: false, isWritable: false },
          { pubkey: TOKEN, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  const signature = await broadcastSigned(signed);
  return { opened: missing.map((row) => row.symbol), signature };
}

export type AttachedHold = {
  sol: number;
  token: Record<string, number>;
  rent: Record<string, number>;
};

/** What is actually on each line. SOL on the first line is the Phantom balance. */
export async function readAttached(owner: string): Promise<AttachedHold> {
  const who = new PublicKey(owner);
  const solRaw = (await chainRpc("getBalance", [owner])) as { value?: number };
  const token: Record<string, number> = {};
  const rent: Record<string, number> = {};
  await Promise.all(
    ATTACHED.filter((row) => row.mint).map(async (row) => {
      const addr = attachedAddress(owner, row);
      const bal = (await chainRpc("getTokenAccountBalance", [addr]).catch(() => null)) as { value?: { uiAmount?: number } } | null;
      const lamports = (await chainRpc("getBalance", [addr]).catch(() => null)) as { value?: number } | null;
      token[row.id] = Number(bal?.value?.uiAmount) || 0;
      rent[row.id] = (Number(lamports?.value) || 0) / 1e9;
    }),
  );
  void who;
  return { sol: (Number(solRaw?.value) || 0) / 1e9, token, rent };
}

/** Close an empty token account and send its rent SOL back to the Phantom. */
export async function returnRent(owner: string, mint: string): Promise<string> {
  const who = new PublicKey(owner);
  const tokenMint = new PublicKey(mint);
  const account = PublicKey.findProgramAddressSync([who.toBytes(), TOKEN.toBytes(), tokenMint.toBytes()], ATA)[0];
  const bal = (await chainRpc("getTokenAccountBalance", [account.toBase58()])) as { value?: { amount?: string } } | null;
  if (BigInt(bal?.value?.amount || "0") > 0n) throw new Error("That account still holds tokens. Move them first.");
  const data = Buffer.alloc(1);
  data.writeUInt8(9, 0);
  const tx = new Transaction();
  tx.feePayer = who;
  const hash = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  tx.recentBlockhash = hash.value.blockhash;
  tx.add(
    new TransactionInstruction({
      programId: TOKEN,
      keys: [
        { pubkey: account, isSigner: false, isWritable: true },
        { pubkey: who, isSigner: false, isWritable: true },
        { pubkey: who, isSigner: true, isWritable: false },
      ],
      data,
    }),
  );
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}
