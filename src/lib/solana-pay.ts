/**
 * Pay a Solana address in USDC. The wallet signs. Senda does not hold the key.
 * This is the spend a merchant on Solana can clear. It is not a Visa number.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { sendSignedRaw, signAndBroadcast, signForJournal, simulateSignedRaw } from "@/lib/phantom";
import { checkSendRecovery, journaledSend, markNotBroadcast, SendOutcomeUncertain } from "@/lib/journaled-send.mjs";
import { ataCreateIdempotentData, transferCheckedData } from "@/lib/spl-instructions.mjs";
import { assertCents, centsToDecimalString, centsToUsdcRaw, USDC_DECIMALS, usdNumberToCents } from "@/lib/usdc-amount.mjs";
import { assertNoPendingDuplicate } from "@/lib/tx-journal.mjs";
import { withWalletExecutionLock } from "@/lib/wallet-execution-lock.mjs";
import { quoteRoute, SOL } from "@/lib/jup-sign";
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

async function latestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const result = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as {
    value?: { blockhash?: string; lastValidBlockHeight?: number };
  };
  const hash = result?.value?.blockhash;
  const last = result?.value?.lastValidBlockHeight;
  if (!hash || !Number.isSafeInteger(last)) throw new Error("No blockhash.");
  return { blockhash: hash, lastValidBlockHeight: last as number };
}

async function blockhash(): Promise<string> {
  return (await latestBlockhash()).blockhash;
}

async function accountExists(address: PublicKey): Promise<boolean> {
  const result = (await rpc("getAccountInfo", [address.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  return Boolean(result?.value);
}

/**
 * USDC from the connected wallet to `to`. Memo carries the reference Solana Pay uses.
 * Pass integer `cents` (preferred). `usd` remains for legacy callers and is converted once to cents.
 * The transfer is TransferChecked (mint + 6 decimals verified on-chain), the recipient token
 * account is created idempotently, and the signed transaction is journaled before broadcast.
 * `deskFee` (from later main) adds an optional TransferChecked desk cut and is returned as `feeUsd`.
 */
export async function payUsdc(input: { owner: string; to: string; cents?: number; usd?: number; memo?: string; deskFee?: boolean }): Promise<{ signature: string; reference: string; feeUsd: number }> {
  return withWalletExecutionLock(input.owner, async () => {
  let owner: PublicKey;
  let to: PublicKey;
  let cents: number;
  let raw: bigint;
  try {
    cents = typeof input.cents === "number" ? assertCents(input.cents) : usdNumberToCents(input.usd as number);
    const capCents = Math.round(spendCap() * 100);
    const feeCents = input.deskFee ? Math.round(sendCut(cents / 100).usd * 100) : 0;
    if (cents + feeCents > capCents) throw new Error(`That is over the spend cap of ${spendCap()}. Raise it on the wallet, or send less.`);
    try {
      owner = new PublicKey(input.owner);
      to = new PublicKey(input.to.trim());
    } catch {
      throw new Error("That is not a Solana address.");
    }
    if (owner.equals(to)) throw new Error("Pay someone else.");
    raw = centsToUsdcRaw(cents);
  } catch (e) {
    throw markNotBroadcast(e);
  }
  const journalDraft = {
    owner: owner.toBase58(), kind: "send" as const,
    asset: "USDC", destination: to.toBase58(), amountRaw: raw.toString(),
  };
  try {
    assertNoPendingDuplicate(window.localStorage, journalDraft);
  } catch (e) {
    // A matching pending transfer exists or the journal is unreadable: never treat as safe to retry.
    throw new SendOutcomeUncertain(e instanceof Error ? e.message : "A matching transfer may already be on-chain.");
  }
  const source = ata(owner);
  const dest = ata(to);
  const reference = Keypair.generate().publicKey;
  const ix: TransactionInstruction[] = [];
  let latest: { blockhash: string; lastValidBlockHeight: number };
  let feeUsd = 0;
  try {
    if (!(await accountExists(source))) throw new Error("This wallet has no USDC account.");
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
          // CreateIdempotent: still succeeds if the account appears between the check and the send.
          data: Buffer.from(ataCreateIdempotentData()),
        }),
      );
    }
    ix.push(
      new TransactionInstruction({
        programId: TOKEN,
        keys: [
          { pubkey: source, isSigner: false, isWritable: true },
          { pubkey: USDC_MINT, isSigner: false, isWritable: false },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: owner, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(transferCheckedData(raw, USDC_DECIMALS)),
      }),
    );
    const memoText = (input.memo ?? `Senda USDC ${centsToDecimalString(cents)}`).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 80);
    const memo = `${memoText} ref=${reference.toBase58()}`;
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
    if (input.deskFee) {
      const cut = sendCut(cents / 100);
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
                  { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                  { pubkey: feeDest, isSigner: false, isWritable: true },
                  { pubkey: owner, isSigner: true, isWritable: false },
                ],
                data: Buffer.from(transferCheckedData(centsToUsdcRaw(Math.round(feeUsd * 100)), USDC_DECIMALS)),
              }),
            );
          }
        } catch {
          feeUsd = 0;
        }
      }
    }
    latest = await latestBlockhash();
  } catch (e) {
    throw markNotBroadcast(e);
  }
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = latest.blockhash;
  tx.add(...ix);
  // Journal the signed transaction's signature before it is broadcast; the receipt is the chain confirmation.
  const { signature } = await journaledSend({
    storage: window.localStorage,
    draft: { ...journalDraft, lastValidBlockHeight: latest.lastValidBlockHeight },
    sign: () => signForJournal(tx),
    preflight: simulateSignedRaw,
    send: sendSignedRaw,
    rpc,
  });
  fileFill({ owner: input.owner, symbol: "USDC", side: "send", usd: cents / 100, mint: USDC_MINT.toBase58(), signature });
  return { signature, reference: reference.toBase58(), feeUsd };
  });
}

/** Check the journal and the chain before a retry is allowed after an uncertain send. */
export function checkUsdcSendRecovery(owner: string, signature: string | null) {
  return checkSendRecovery({ storage: window.localStorage, owner, rpc, signature });
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
  return withWalletExecutionLock(input.owner, async () => {
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
  if (!Number.isSafeInteger(lamports) || lamports < 1) throw new Error("Enter an exact SOL amount.");
  // A SOL send also consumes the dollar-denominated wallet spend cap.
  const quoted = await quoteRoute({ inputMint: SOL, outputMint: USDC_MINT.toBase58(), amountRaw: lamports, outDecimals: 6 });
  if (!(quoted.outUi > 0) || !Number.isFinite(quoted.outUi)) throw new Error("Could not value SOL for the spending limit.");
  if (quoted.outUi > spendCap()) throw new Error("This SOL transfer exceeds your wallet spend cap.");
  const journalDraft = {
    owner: owner.toBase58(), kind: "send" as const,
    asset: "SOL", destination: to.toBase58(), amountRaw: String(lamports),
  };
  try {
    assertNoPendingDuplicate(window.localStorage, journalDraft);
  } catch (e) {
    throw new SendOutcomeUncertain(e instanceof Error ? e.message : "A matching transfer may already be on-chain.");
  }
  const latest = await latestBlockhash();
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = latest.blockhash;
  tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: to, lamports }));
  const { signature } = await journaledSend({
    storage: window.localStorage,
    draft: { ...journalDraft, lastValidBlockHeight: latest.lastValidBlockHeight },
    sign: () => signForJournal(tx),
    preflight: simulateSignedRaw,
    send: sendSignedRaw,
    rpc,
  });
  return signature;
  });
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
