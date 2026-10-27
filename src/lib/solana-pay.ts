/**
 * Pay a Solana address in USDC. The wallet signs. Senda does not hold the key.
 * This is the spend a merchant on Solana can clear. It is not a Visa number.
 */

import { Buffer } from "buffer";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { transferData } from "@/lib/chain-codec";
import { broadcastSigned, chainRpc as rpc, requirePhantom, symbolFor } from "@/lib/phantom";
import { assertSpend } from "@/lib/spend-cap";
import { fileFill } from "@/lib/trade-log";
import { deskFeeAccount, sendCut } from "@/lib/desk-fee";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

function ata(owner: PublicKey): PublicKey {
  return ataOf(owner, USDC_MINT);
}

function ataOf(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
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

/** Phantom signs first, then the signed transaction is broadcast. This is the send that already landed. */
async function signLegacy(owner: PublicKey, instructions: TransactionInstruction[]): Promise<string> {
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...instructions);
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}

/** USDC from the connected wallet to `to`. Memo carries the reference Solana Pay uses. */
export async function payUsdc(input: { owner: string; to: string; usd: number; memo?: string; deskFee?: boolean }): Promise<{ signature: string; reference: string; feeUsd: number }> {
  const usd = Math.round(input.usd * 1_000_000) / 1_000_000;
  if (!(usd >= 0.001)) throw new Error("The smallest stake is a tenth of a cent.");
  assertSpend(usd);
  let to: PublicKey;
  let owner: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    to = new PublicKey(input.to.trim());
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (owner.equals(to)) throw new Error("Pay someone else.");
  const source = ata(owner);
  if (!(await accountExists(source))) throw new Error("This wallet has no USDC account.");
  const dest = ata(to);
  const raw = BigInt(Math.round(usd * 1_000_000));
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
      data: Buffer.from(transferData(raw)),
    }),
  );
  let feeUsd = 0;
  if (input.deskFee) {
    const cut = sendCut(usd);
    const acct = deskFeeAccount();
    if (cut.usd > 0 && acct) {
      const feeDest = new PublicKey(acct);
      if (!feeDest.equals(dest) && (await accountExists(feeDest))) {
        feeUsd = cut.usd;
        ix.push(
          new TransactionInstruction({
            programId: TOKEN,
            keys: [
              { pubkey: source, isSigner: false, isWritable: true },
              { pubkey: feeDest, isSigner: false, isWritable: true },
              { pubkey: owner, isSigner: true, isWritable: false },
            ],
            data: Buffer.from(transferData(BigInt(Math.round(feeUsd * 1_000_000)))),
          }),
        );
      } else {
        feeUsd = 0;
      }
    }
  }
  const signature = await signLegacy(owner, ix);
  fileFill({ owner: input.owner, symbol: "USDC", side: "send", usd, mint: USDC_MINT.toBase58(), signature, platformFeeBps: feeUsd > 0 ? 4 : 0 });
  return { signature, reference: signature, feeUsd };
}

/** Any 6-decimal stable the wallet holds. Same signature path as USDC. Senda does not hold the token. */
export async function payToken(input: { owner: string; to: string; mint: string; symbol: string; amount: number }): Promise<{ signature: string }> {
  const amount = Math.round(input.amount * 1_000_000) / 1_000_000;
  if (!(amount >= 0.001)) throw new Error("Send at least 0.001.");
  assertSpend(amount);
  let to: PublicKey;
  let owner: PublicKey;
  let mint: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    to = new PublicKey(input.to.trim());
    mint = new PublicKey(input.mint);
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (owner.equals(to)) throw new Error("Pay someone else.");
  const source = ataOf(owner, mint);
  if (!(await accountExists(source))) throw new Error(`This wallet has no ${input.symbol}.`);
  const dest = ataOf(to, mint);
  const raw = BigInt(Math.round(amount * 1_000_000));
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
  const signature = await signLegacy(owner, ix);
  fileFill({ owner: input.owner, symbol: input.symbol, side: "send", usd: amount, mint: input.mint, signature });
  return { signature };
}


/** Several USDC payments in one signature. A US address and a Mexico address can ride together. */
export async function payBatch(input: { owner: string; rows: { to: string; usd: number; memo?: string }[] }): Promise<string> {
  const rows = input.rows
    .map((row) => ({ to: row.to.trim(), usd: Math.round(row.usd * 1_000_000) / 1_000_000, memo: row.memo }))
    .filter((row) => row.to && row.usd >= 0.001);
  if (rows.length < 2) throw new Error("Add at least two payments.");
  if (rows.length > 6) throw new Error("Six payments fit in one signature. Send the rest after.");
  const sum = rows.reduce((n, row) => n + row.usd, 0);
  assertSpend(sum);
  let owner: PublicKey;
  try {
    owner = new PublicKey(input.owner);
  } catch {
    throw new Error("That is not a Solana address.");
  }
  const source = ata(owner);
  if (!(await accountExists(source))) throw new Error("This wallet has no USDC account.");
  const ix: TransactionInstruction[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    let to: PublicKey;
    try {
      to = new PublicKey(row.to);
    } catch {
      throw new Error("One of those addresses is not Solana.");
    }
    if (owner.equals(to)) throw new Error("Pay someone else.");
    if (seen.has(to.toBase58())) throw new Error("That address is already in this batch.");
    seen.add(to.toBase58());
    const dest = ata(to);
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
    const raw = BigInt(Math.round(row.usd * 1_000_000));
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
  }
  const signature = await signLegacy(owner, ix);
  fileFill({
    owner: input.owner,
    symbol: "USDC",
    side: "send",
    usd: rows.reduce((n, row) => n + row.usd, 0),
    mint: USDC_MINT.toBase58(),
    signature,
  });
  return signature;
}

/** SOL from the connected wallet to another address. The wallet signs. */
export async function paySol(input: { owner: string; to: string; sol: number }): Promise<string> {
  const sol = Math.round(input.sol * 1e9) / 1e9;
  if (!(sol >= 0.0001)) throw new Error("That amount is too small.");
  let to: PublicKey;
  let owner: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    to = new PublicKey(input.to.trim());
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (owner.equals(to)) throw new Error("Send it to a different wallet.");
  const signature = await signLegacy(owner, [SystemProgram.transfer({ fromPubkey: owner, toPubkey: to, lamports: Math.round(sol * 1e9) })]);
  fileFill({ owner: input.owner, symbol: "SOL", side: "send", usd: 0, mint: "So11111111111111111111111111111111111111112", signature });
  return signature;
}

/** A classic SPL token, not Token-2022, to another address. Phantom signs. */
export async function payMint(input: { owner: string; to: string; mint: string; ui: number; decimals: number; usd?: number }): Promise<string> {
  if (!(input.ui > 0)) throw new Error("Enter an amount.");
  if ((input.usd ?? 0) > 0) assertSpend(input.usd ?? 0);
  let owner: PublicKey;
  let to: PublicKey;
  let mint: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    to = new PublicKey(input.to.trim());
    mint = new PublicKey(input.mint);
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (owner.equals(to)) throw new Error("Send it to a different wallet.");
  const info = (await rpc("getAccountInfo", [mint.toBase58(), { encoding: "base64" }])) as { value?: { owner?: string } };
  if (info?.value?.owner !== TOKEN.toBase58()) throw new Error("That token cannot be sent from this desk.");
  const source = ataOf(owner, mint);
  if (!(await accountExists(source))) throw new Error("This wallet does not hold that token.");
  const dest = ataOf(to, mint);
  const raw = BigInt(Math.round(input.ui * 10 ** input.decimals));
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
  const signature = await signLegacy(owner, ix);
  fileFill({
    owner: input.owner,
    symbol: symbolFor(input.mint),
    side: "send",
    usd: input.usd || 0,
    mint: input.mint,
    signature,
  });
  return signature;
}

export type TransferRequest = {
  recipient: string;
  amount?: number;
  splToken?: string;
  reference: string[];
  label?: string;
  message?: string;
  memo?: string;
};

/** solana:<wallet>?amount&spl-token&reference&label&message&memo. Not an associated-token address. */
export function transferRequest(input: {
  recipient: string;
  amount?: number;
  splToken?: string;
  reference?: string | string[];
  label?: string;
  message?: string;
  memo?: string;
}): string {
  const recipient = new PublicKey(input.recipient).toBase58();
  const q = new URLSearchParams();
  if (input.amount && input.amount > 0) q.set("amount", String(input.amount));
  if (input.splToken) q.set("spl-token", input.splToken);
  const refs = input.reference == null ? [] : Array.isArray(input.reference) ? input.reference : [input.reference];
  for (const ref of refs) if (ref) q.append("reference", ref);
  if (input.label) q.set("label", input.label);
  if (input.message) q.set("message", input.message);
  if (input.memo) q.set("memo", input.memo);
  const query = q.toString();
  return query ? `solana:${recipient}?${query}` : `solana:${recipient}`;
}

export function parseTransfer(raw: string): TransferRequest | { error: string } {
  const text = raw.trim();
  if (!text.toLowerCase().startsWith("solana:")) {
    try {
      const recipient = new PublicKey(text).toBase58();
      return { recipient, reference: [] };
    } catch {
      return { error: "That QR is not a Solana address or a solana: link." };
    }
  }
  try {
    const body = text.slice(text.indexOf(":") + 1);
    const cut = body.indexOf("?");
    const recipient = new PublicKey(cut < 0 ? body : body.slice(0, cut)).toBase58();
    const q = new URLSearchParams(cut < 0 ? "" : body.slice(cut + 1));
    const amount = Number(q.get("amount") || "");
    return {
      recipient,
      amount: amount > 0 ? amount : undefined,
      splToken: q.get("spl-token") || undefined,
      reference: q.getAll("reference"),
      label: q.get("label") || undefined,
      message: q.get("message") || undefined,
      memo: q.get("memo") || undefined,
    };
  } catch {
    return { error: "Could not read that link." };
  }
}

/** Same seed, same reference address. The chain can be searched for it. */
export function payReference(seed: string): string {
  const raw = new TextEncoder().encode(`senda-ref:${seed}`);
  const buf = new Uint8Array(32);
  for (let n = 0; n < 255; n += 1) {
    buf.fill(n);
    for (let i = 0; i < raw.length; i += 1) buf[i % 32] ^= raw[i];
    buf[31] = n;
    try {
      return new PublicKey(buf).toBase58();
    } catch {
      /* not on the curve */
    }
  }
  throw new Error("Could not make a reference.");
}

/** A signature that named this reference, if one has landed. */
export async function findPay(reference: string): Promise<string | null> {
  const rows = (await rpc("getSignaturesForAddress", [reference, { limit: 1 }])) as Array<{ signature?: string }> | null;
  const sig = rows?.[0]?.signature;
  return sig || null;
}
