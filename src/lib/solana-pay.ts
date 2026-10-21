/**
 * Pay a Solana address in USDC. The wallet signs. Senda does not hold the key.
 * This is the spend a merchant on Solana can clear. It is not a Visa number.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { broadcastSigned, chainRpc, phantomProvider } from "@/lib/phantom";
import { fundUsdc } from "@/lib/jup-sign";
import { noteAct } from "@/lib/book";
import { stageMove } from "@/lib/moves";
import { spendCap } from "@/lib/spend-cap";
import { activeSolProvider } from "@/lib/wallets";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

function rpc(method: string, params: unknown[]): Promise<unknown> {
  return chainRpc(method, params);
}

function ata(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN.toBuffer(), USDC_MINT.toBuffer()],
    ATA_PROGRAM,
  )[0];
}

function u64(amount: bigint): Uint8Array {
  const d = new Uint8Array(9);
  d[0] = 3;
  new DataView(d.buffer).setBigUint64(1, amount, true);
  return d;
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

/** USDC from the connected wallet to `to`. Memo carries the reference Solana Pay uses. */
export async function payUsdc(input: { owner: string; to: string; usd: number; memo?: string }): Promise<{ signature: string; reference: string }> {
  const usd = Math.round(input.usd * 100) / 100;
  if (!(usd > 0)) throw new Error("Enter an amount.");
  const cap = spendCap();
  if (usd > cap) throw new Error(`That is over the spend cap of ${cap}. Raise it on the wallet, or send less.`);
  let to: PublicKey;
  let owner: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    to = new PublicKey(input.to.trim());
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (owner.equals(to)) throw new Error("Pay someone else.");
  await fundUsdc(input.owner, usd);
  const source = ata(owner);
  if (!(await accountExists(source))) throw new Error("Jupiter did not leave USDC on this account. The send did not go out.");
  const dest = ata(to);
  const raw = BigInt(Math.round(usd * 1_000_000));
  const reference = Keypair.generate().publicKey;
  const ix: TransactionInstruction[] = [];
  if (!(await accountExists(dest))) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: owner, isSigner: true, isWritable: true },
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
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(u64(raw)),
    }),
  );
  const memo = `${input.memo ?? `Senda USDC ${usd}`} ref=${reference.toBase58()}`;
  ix.push(
    new TransactionInstruction({
      programId: MEMO,
      keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
      data: Buffer.from(new TextEncoder().encode(memo)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const provider = (activeSolProvider() as ReturnType<typeof phantomProvider>) ?? phantomProvider();
  if (!provider?.signTransaction) throw new Error("Connect a Solana wallet in this window. It has to sign.");
  const signed = await provider.signTransaction(tx);
  stageMove({ usd, kind: "send", title: `Sent $${usd.toFixed(2)} USDC` });
  const signature = await broadcastSigned(signed);
  noteAct({
    kind: "send",
    title: `Sent $${usd.toFixed(2)} USDC`,
    detail: input.memo || `To ${input.to.slice(0, 4)}…${input.to.slice(-4)}`,
    signature,
  });
  return { signature, reference: reference.toBase58() };
}

const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const SOL_MINT = "So11111111111111111111111111111111111111112";

export const SEND_ASSETS = [
  { id: "SOL", label: "SOL", decimals: 9, mint: "" },
  { id: "USDC", label: "USDC", decimals: 6, mint: USDC_MINT.toBase58() },
  { id: "CASH", label: "CASH", decimals: 6, mint: "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH" },
  { id: "USDT", label: "USDT", decimals: 6, mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { id: "PYUSD", label: "PYUSD", decimals: 6, mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo" },
] as const;

export type SendAssetId = (typeof SEND_ASSETS)[number]["id"];

export function usdcPayLink(to: string, usd: number, memo: string): string {
  return assetPayLink("USDC", to, usd, memo);
}

export function assetPayLink(asset: SendAssetId, to: string, amount: number, memo = ""): string {
  const row = SEND_ASSETS.find((a) => a.id === asset) ?? SEND_ASSETS[1];
  return splPayLink(to, row.mint, amount, memo);
}

export function splPayLink(to: string, mint: string, amount: number, memo = ""): string {
  const q = new URLSearchParams();
  if (amount > 0) q.set("amount", String(amount));
  if (mint) q.set("spl-token", mint);
  if (memo.trim()) q.set("memo", memo.trim().slice(0, 80));
  q.set("label", "Senda");
  const query = q.toString();
  return query ? `solana:${to.trim()}?${query}` : `solana:${to.trim()}`;
}

async function solPrice(): Promise<number> {
  const res = await fetch(`https://api.jup.ag/price/v3?ids=${SOL_MINT}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("Could not price SOL.");
  const body = (await res.json()) as Record<string, { usdPrice?: number }>;
  const px = Number(body[SOL_MINT]?.usdPrice);
  if (!(px > 0)) throw new Error("Could not price SOL.");
  return px;
}

export async function paySol(input: { owner: string; to: string; sol: number; memo?: string }): Promise<{ signature: string; reference: string }> {
  const sol = Math.round(input.sol * 1e6) / 1e6;
  if (!(sol > 0)) throw new Error("Enter an amount.");
  const usd = sol * (await solPrice());
  const cap = spendCap();
  if (usd > cap) throw new Error(`That is about $${usd.toFixed(0)}. Your send cap is $${cap}.`);
  let to: PublicKey;
  let owner: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    to = new PublicKey(input.to.trim());
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (owner.equals(to)) throw new Error("Pay someone else.");
  const lamports = BigInt(Math.round(sol * 1e9));
  const reference = Keypair.generate().publicKey;
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(
    SystemProgram.transfer({ fromPubkey: owner, toPubkey: to, lamports }),
    new TransactionInstruction({
      programId: MEMO,
      keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
      data: Buffer.from(new TextEncoder().encode(`${input.memo ?? `Senda SOL ${sol}`} ref=${reference.toBase58()}`)),
    }),
  );
  const provider = (activeSolProvider() as ReturnType<typeof phantomProvider>) ?? phantomProvider();
  if (!provider?.signTransaction) throw new Error("Connect a Solana wallet in this window. It has to sign.");
  const signed = await provider.signTransaction(tx);
  stageMove({ usd: 0, kind: "send", title: `Sent ${sol} SOL` });
  const signature = await broadcastSigned(signed);
  noteAct({ kind: "send", title: `Sent ${sol} SOL`, detail: input.memo || `To ${input.to.slice(0, 4)}…${input.to.slice(-4)}`, signature });
  return { signature, reference: reference.toBase58() };
}

export async function paySpl(input: {
  owner: string;
  to: string;
  amount: number;
  mint: string;
  symbol: string;
  memo?: string;
}): Promise<{ signature: string; reference: string }> {
  const amount = Math.round(input.amount * 100) / 100;
  if (!(amount > 0)) throw new Error("Enter an amount.");
  const cap = spendCap();
  if (amount > cap) throw new Error(`That is over the spend cap of ${cap}.`);
  let mint: PublicKey;
  let to: PublicKey;
  let owner: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    to = new PublicKey(input.to.trim());
    mint = new PublicKey(input.mint);
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (owner.equals(to)) throw new Error("Pay someone else.");
  const program = mint.toBase58() === "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo" || mint.toBase58() === "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH" ? TOKEN_2022 : TOKEN;
  const source = PublicKey.findProgramAddressSync([owner.toBuffer(), program.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
  if (!(await accountExists(source))) throw new Error(`This wallet has no ${input.symbol} account.`);
  const dest = PublicKey.findProgramAddressSync([to.toBuffer(), program.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
  const raw = BigInt(Math.round(amount * 1_000_000));
  const reference = Keypair.generate().publicKey;
  const ix: TransactionInstruction[] = [];
  if (!(await accountExists(dest))) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: owner, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: to, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: SYSTEM, isSigner: false, isWritable: false },
          { pubkey: program, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  const data = new Uint8Array(10);
  data[0] = 12;
  new DataView(data.buffer).setBigUint64(1, raw, true);
  data[9] = 6;
  ix.push(
    new TransactionInstruction({
      programId: program,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(data),
    }),
  );
  ix.push(
    new TransactionInstruction({
      programId: MEMO,
      keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
      data: Buffer.from(new TextEncoder().encode(`${input.memo ?? `Senda ${input.symbol} ${amount}`} ref=${reference.toBase58()}`)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const provider = (activeSolProvider() as ReturnType<typeof phantomProvider>) ?? phantomProvider();
  if (!provider?.signTransaction) throw new Error("Connect a Solana wallet in this window. It has to sign.");
  const signed = await provider.signTransaction(tx);
  stageMove({ usd: input.symbol === "USDC" ? amount : 0, kind: "send", title: `Sent ${amount} ${input.symbol}` });
  const signature = await broadcastSigned(signed);
  noteAct({ kind: "send", title: `Sent ${amount} ${input.symbol}`, detail: input.memo || `To ${input.to.slice(0, 4)}…${input.to.slice(-4)}`, signature });
  return { signature, reference: reference.toBase58() };
}

export async function payAsset(input: {
  owner: string;
  to: string;
  asset: SendAssetId;
  amount: number;
  memo?: string;
}): Promise<{ signature: string; reference: string }> {
  if (input.asset === "SOL") return paySol({ owner: input.owner, to: input.to, sol: input.amount, memo: input.memo });
  if (input.asset === "USDC") return payUsdc({ owner: input.owner, to: input.to, usd: input.amount, memo: input.memo });
  const row = SEND_ASSETS.find((a) => a.id === input.asset);
  if (!row?.mint) throw new Error("That asset is not on this desk.");
  return paySpl({ owner: input.owner, to: input.to, amount: input.amount, mint: row.mint, symbol: row.id, memo: input.memo });
}
