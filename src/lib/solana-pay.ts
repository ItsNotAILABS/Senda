/**
 * Pay a Solana address in USDC. The wallet signs. Senda does not hold the key.
 * This is the spend a merchant on Solana can clear. It is not a Visa number.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { signAndBroadcast } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";
import { deskFeeAccount, sendCut } from "@/lib/desk-fee";
import { fileFill } from "@/lib/trade-log";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

/** A Solana Pay request. The recipient's wallet asks to sign. Senda never sees the key. */
export function usdcPayLink(to: string, usd: number, memo: string): string {
  const amount = (Math.round(usd * 100) / 100).toFixed(2);
  const q = new URLSearchParams({
    amount,
    "spl-token": USDC_MINT.toBase58(),
    memo: memo.slice(0, 80),
  });
  return `solana:${to.trim()}?${q.toString()}`;
}

function rpc(method: string, params: unknown[]): Promise<unknown> {
  const urls = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
  return (async () => {
    let last = "RPC failed";
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
        if (j.error) {
          last = j.error.message || last;
          continue;
        }
        return j.result;
      } catch (e) {
        last = e instanceof Error ? e.message : last;
      }
    }
    throw new Error(last);
  })();
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
export async function payUsdc(input: { owner: string; to: string; usd: number; memo?: string; deskFee?: boolean }): Promise<{ signature: string; reference: string; feeUsd: number }> {
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
  const source = ata(owner);
  if (!(await accountExists(source))) throw new Error("This wallet has no USDC account.");
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
      keys: [
        { pubkey: owner, isSigner: true, isWritable: false },
        { pubkey: reference, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(new TextEncoder().encode(memo)),
    }),
  );
  let feeUsd = 0;
  if (input.deskFee) {
    const cut = sendCut(usd);
    const acct = deskFeeAccount();
    if (cut.usd > 0 && acct) {
      try {
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
              data: Buffer.from(u64(BigInt(Math.round(feeUsd * 1_000_000)))),
            }),
          );
        }
      } catch {
        feeUsd = 0;
      }
    }
  }
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const signature = await signAndBroadcast(tx);
  fileFill({ owner: input.owner, symbol: "USDC", side: "send", usd, mint: USDC_MINT.toBase58(), signature });
  return { signature, reference: reference.toBase58(), feeUsd };
}

/** An SPL the wallet already holds. Decimals default to 6. The mint's own program signs the move, so Cash and USDT leave the same way USDC does. */
export async function payToken(input: { owner: string; to: string; mint: string; symbol: string; amount: number; decimals?: number }): Promise<{ signature: string }> {
  const decimals = input.decimals ?? 6;
  const scale = 10 ** decimals;
  const amount = Math.round(input.amount * scale) / scale;
  if (!(amount > 0)) throw new Error("Enter an amount.");
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
  const info = (await rpc("getAccountInfo", [mint.toBase58(), { encoding: "base64" }])) as { value?: { owner?: string } | null };
  const programId = info?.value?.owner;
  if (programId !== TOKEN.toBase58() && programId !== TOKEN_2022.toBase58()) throw new Error("That token cannot be sent from this wallet.");
  const program = new PublicKey(programId);
  const source = PublicKey.findProgramAddressSync([owner.toBuffer(), program.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
  if (!(await accountExists(source))) throw new Error(`This wallet has no ${input.symbol}.`);
  const dest = PublicKey.findProgramAddressSync([to.toBuffer(), program.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
  const raw = BigInt(Math.round(amount * scale));
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
  ix.push(
    new TransactionInstruction({
      programId: program,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(u64(raw)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const signature = await signAndBroadcast(tx);
  fileFill({ owner: input.owner, symbol: input.symbol, side: "send", usd: amount, mint: input.mint, signature });
  return { signature };
}

/** SOL from the connected wallet. Phantom signs. Senda does not hold the key. */
export async function paySol(input: { owner: string; to: string; sol: number }): Promise<string> {
  if (!(input.sol > 0)) throw new Error("Enter an amount.");
  let owner: PublicKey;
  let to: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    to = new PublicKey(input.to.trim());
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (owner.equals(to)) throw new Error("Pay someone else.");
  const lamports = Math.round(input.sol * 1_000_000_000);
  if (lamports < 1) throw new Error("Enter an amount.");
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: to, lamports }));
  return signAndBroadcast(tx);
}

function ataOf(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}

/** Several USDC payments in one signature. */
export async function payBatch(input: { owner: string; rows: { to: string; usd: number; memo?: string }[] }): Promise<string> {
  const rows = input.rows
    .map((row) => ({ to: row.to.trim(), usd: Math.round(row.usd * 1_000_000) / 1_000_000, memo: row.memo }))
    .filter((row) => row.to && row.usd >= 0.001);
  if (rows.length < 2) throw new Error("Add at least two payments.");
  if (rows.length > 6) throw new Error("Six payments fit in one signature. Send the rest after.");
  const sum = rows.reduce((n, row) => n + row.usd, 0);
  const cap = spendCap();
  if (sum > cap) throw new Error(`That is over the spend cap of ${cap}. Raise it on the wallet, or send less.`);
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
    ix.push(
      new TransactionInstruction({
        programId: TOKEN,
        keys: [
          { pubkey: source, isSigner: false, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: owner, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(u64(BigInt(Math.round(row.usd * 1_000_000)))),
      }),
    );
  }
  const memo = rows.map((row) => row.memo).find((row) => row);
  if (memo) {
    ix.push(
      new TransactionInstruction({
        programId: MEMO,
        keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
        data: Buffer.from(new TextEncoder().encode(memo.slice(0, 200))),
      }),
    );
  }
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const signature = await signAndBroadcast(tx);
  fileFill({ owner: input.owner, symbol: "USDC", side: "send", usd: sum, mint: USDC_MINT.toBase58(), signature });
  return signature;
}

/** A classic SPL token, not Token-2022, to another address. The wallet signs. */
export async function payMint(input: { owner: string; to: string; mint: string; ui: number; decimals: number; usd?: number }): Promise<string> {
  if (!(input.ui > 0)) throw new Error("Enter an amount.");
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
      data: Buffer.from(u64(raw)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const signature = await signAndBroadcast(tx);
  fileFill({ owner: input.owner, symbol: "SPL", side: "send", usd: input.usd || 0, mint: input.mint, signature });
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

/** solana:<wallet>?amount&spl-token&reference&label&message&memo. */
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
      return { recipient: new PublicKey(text).toBase58(), reference: [] };
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
  return rows?.[0]?.signature || null;
}
