/**
 * A cover is a transaction. Premium USDC leaves Phantom into a cover account.
 * The key for that account stays in this browser so a settle can pay it back.
 * Senda does not print the payout.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { coverMemo, transferData } from "@/lib/chain-codec";
import { requirePhantom, broadcastSigned, chainRpc as rpc, splHolding } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const BOOK = "senda.cover.chain.v1";
const KP = "senda.cover.kp.v1";

export type CoverKind = "drop" | "drop5" | "life";

export type ChainCover = {
  id: string;
  sig: string;
  kind: CoverKind;
  title: string;
  symbol: string;
  mint: string;
  strike: number;
  cover: number;
  premium: number;
  until: number;
  status: "open" | "settled" | "cancelled";
  owner?: string;
};

function ata(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN.toBuffer(), USDC_MINT.toBuffer()],
    ATA_PROGRAM,
  )[0];
}

export function coverPubkey(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(KP) || "";
  if (!raw) return "";
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[])).publicKey.toBase58();
  } catch {
    return "";
  }
}

function coverKey(): Keypair {
  if (typeof window === "undefined") throw new Error("A cover does not get a key in this browser.");
  const raw = window.localStorage.getItem(KP) || "";
  if (!raw) throw new Error("A cover does not get a key in this browser. The premium leaves the wallet you sign with.");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

export function listChainCovers(): ChainCover[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(BOOK) || "[]") as ChainCover[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: ChainCover[]) {
  window.localStorage.setItem(BOOK, JSON.stringify(rows));
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

export async function coverUsdc(): Promise<number> {
  const held = await splHolding(coverPubkey(), USDC_MINT.toBase58());
  return held.ui;
}

/** 10% drop settles at 90% of the strike. 5% drop settles at 95%. A label has no print line. */
export function coverStrikeRatio(kind: CoverKind): number | null {
  switch (kind) {
    case "drop":
      return 0.9;
    case "drop5":
      return 0.95;
    case "life":
      return null;
  }
}

/** 10% is 4% of size. 5% is 2.5% of size. Both are at least 25 cents. Life is the fixed label premium. */
export function coverPremium(kind: CoverKind, size: number, lifePremium = 0): number {
  switch (kind) {
    case "drop":
      return Math.max(0.25, Math.round(size * 4) / 100);
    case "drop5":
      return Math.max(0.25, Math.round(size * 2.5) / 100);
    case "life":
      return lifePremium;
  }
}

function dropPercent(kind: CoverKind): "10%" | "5%" | null {
  switch (kind) {
    case "drop":
      return "10%";
    case "drop5":
      return "5%";
    case "life":
      return null;
  }
}

/** Move the premium in USDC and write the terms in a memo. You sign. */
export async function openChainCover(input: {
  owner: string;
  kind: CoverKind;
  title: string;
  symbol?: string;
  mint?: string;
  strike?: number;
  cover: number;
  premium: number;
  days: number;
}): Promise<ChainCover> {
  if (!(input.premium > 0)) throw new Error("Set a premium.");
  const owner = new PublicKey(input.owner);
  const vault = coverKey();
  const source = ata(owner);
  const dest = ata(vault.publicKey);
  const raw = BigInt(Math.round(input.premium * 1_000_000));
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
          { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
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
  const kindWord = input.kind === "life" ? "life" : input.kind === "drop5" ? "drop5" : "drop";
  const symbol = (input.symbol || input.title || "COVER").replace(/[^A-Za-z0-9]/g, "") || "COVER";
  const until = Math.floor(Date.now() / 1000) + Math.max(1, input.days) * 86_400;
  const memo = coverMemo({
    kind: kindWord,
    symbol,
    strikeUsd: input.strike || 0,
    coverUsd: input.cover,
    premiumUsd: input.premium,
    until,
  });
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
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  const sig = await broadcastSigned(signed);
  const row: ChainCover = {
    id: sig,
    sig,
    kind: input.kind,
    title: input.title,
    symbol: input.symbol || "",
    mint: input.mint || "",
    strike: input.strike || 0,
    cover: input.cover,
    premium: input.premium,
    until: Date.now() + input.days * 86_400_000,
    status: "open",
    owner: input.owner,
  };
  save([row, ...listChainCovers()]);
  // The transfer already landed. A failed balance read must surface, not disappear.
  await coverUsdc();
  return row;
}

/** Send this cover's premium back. A drop that has fallen also asks you to sign the buy. */
export async function settleChainCover(row: ChainCover, owner: string, price: number): Promise<{ sig: string; bought?: string }> {
  if (row.status !== "open") throw new Error("That cover is already closed.");
  const ratio = coverStrikeRatio(row.kind);
  const hit = ratio != null && row.strike > 0 && price > 0 && price <= row.strike * ratio;
  const expired = Date.now() > row.until;
  const pct = dropPercent(row.kind);
  if (pct != null && !hit && !expired) {
    throw new Error(`${row.symbol} has not fallen ${pct} from ${row.strike}. Cancel if you want the USDC back now.`);
  }
  const sig = await returnPremium(owner, row.premium);
  const next = listChainCovers().map((c) => (c.id === row.id ? { ...c, status: hit ? "settled" : "cancelled" } : c));
  save(next as ChainCover[]);
  let bought: string | undefined;
  if (hit && row.mint) {
    const fill = await runPrestock({ owner, mint: row.mint, side: "buy", usd: row.cover, price });
    bought = fill.signature;
  }
  // The return already landed. A failed balance read must surface, not disappear.
  await coverUsdc();
  return bought ? { sig, bought } : { sig };
}

export async function cancelChainCover(row: ChainCover, owner: string): Promise<string> {
  if (row.status !== "open") throw new Error("That cover is already closed.");
  const sig = await returnPremium(owner, row.premium);
  save(listChainCovers().map((c) => (c.id === row.id ? { ...c, status: "cancelled" } : c)));
  return sig;
}

/** Pay the premium back with the cover key alone, once that address holds SOL for the fee. */
export async function payoutCover(row: ChainCover, price: number): Promise<string> {
  if (row.status !== "open") throw new Error("That cover is already closed.");
  const dest = row.owner;
  if (!dest) throw new Error("This cover has no wallet to pay. Settle it from the wallet that funded it.");
  const ratio = coverStrikeRatio(row.kind);
  const hit = ratio != null && row.strike > 0 && price > 0 && price <= row.strike * ratio;
  const expired = Date.now() > row.until;
  if (!hit && !expired) throw new Error("The print is not through the floor, and the term has not ended.");
  const vault = coverKey();
  const bal = (await rpc("getBalance", [vault.publicKey.toBase58()])) as { value?: number };
  if ((bal?.value || 0) < 8_000) throw new Error("Send about 0.01 SOL to the cover address once. Then a hit pays out without Phantom.");
  const source = ata(vault.publicKey);
  const held = await splHolding(vault.publicKey.toBase58(), USDC_MINT.toBase58());
  const raw = BigInt(Math.min(Math.round(row.premium * 1_000_000), Number(held.raw) || 0));
  if (raw <= 0n) throw new Error("The cover account has no USDC to send back.");
  const destAta = ata(new PublicKey(dest));
  const tx = new Transaction();
  tx.feePayer = vault.publicKey;
  tx.recentBlockhash = await blockhash();
  if (!(await accountExists(destAta))) {
    tx.add(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: vault.publicKey, isSigner: true, isWritable: true },
          { pubkey: destAta, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(dest), isSigner: false, isWritable: false },
          { pubkey: USDC_MINT, isSigner: false, isWritable: false },
          { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
          { pubkey: TOKEN, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  tx.add(
    new TransactionInstruction({
      programId: TOKEN,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: destAta, isSigner: false, isWritable: true },
        { pubkey: vault.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(transferData(raw)),
    }),
  );
  tx.sign(vault);
  const sig = await broadcastSigned(tx);
  save(listChainCovers().map((c) => (c.id === row.id ? { ...c, status: hit ? "settled" : "cancelled" } : c)));
  return sig;
}

async function returnPremium(ownerAddress: string, premium: number): Promise<string> {
  const owner = new PublicKey(ownerAddress);
  const vault = coverKey();
  const source = ata(vault.publicKey);
  const dest = ata(owner);
  const held = await splHolding(vault.publicKey.toBase58(), USDC_MINT.toBase58());
  const raw = BigInt(Math.min(Math.round(premium * 1_000_000), Number(held.raw) || 0));
  if (raw <= 0n) throw new Error("The cover account has no USDC to send back.");
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(
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
  tx.partialSign(vault);
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}
