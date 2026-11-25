/**
 * Pay a Solana address in USDC. The wallet signs. Senda does not hold the key.
 * This is the spend a merchant on Solana can clear. It is not a Visa number.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { sendSignedRaw, signForJournal, simulateSignedRaw } from "@/lib/phantom";
import { checkSendRecovery, journaledSend, markNotBroadcast, SendOutcomeUncertain } from "@/lib/journaled-send.mjs";
import { ataCreateIdempotentData, transferCheckedData } from "@/lib/spl-instructions.mjs";
import { buildUsdcPayLink, verifyReferencedUsdcPayment } from "@/lib/solana-pay-request.mjs";
import { assertCents, centsToDecimalString, centsToUsdcRaw, USDC_DECIMALS, usdNumberToCents } from "@/lib/usdc-amount.mjs";
import { assertNoPendingDuplicate } from "@/lib/tx-journal.mjs";
import { withWalletExecutionLock } from "@/lib/wallet-execution-lock.mjs";
import { quoteRoute, SOL } from "@/lib/jup-sign";
import { spendCap } from "@/lib/spend-cap";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
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

/** Request by integer cents with a fresh reference key the requester can look up later. */
export function usdcPayRequest(to: string, cents: number, memo: string): { url: string; reference: string } {
  const reference = Keypair.generate().publicKey.toBase58();
  return { url: buildUsdcPayLink({ to, cents, memo, reference, mint: USDC_MINT.toBase58() }), reference };
}

/** Find a confirmed transaction carrying `reference` and verify it paid `cents` USDC to `to`. */
export async function findReferencedUsdcPayment(
  to: string,
  cents: number,
  reference: string,
): Promise<{ paid: boolean; reason: string; signature?: string }> {
  const sigs = (await rpc("getSignaturesForAddress", [reference, { limit: 10, commitment: "confirmed" }])) as
    | { signature: string; err: unknown }[]
    | null;
  if (!Array.isArray(sigs) || !sigs.length) return { paid: false, reason: "No payment with this reference yet." };
  let last = { paid: false, reason: "No matching payment yet." };
  for (const row of sigs) {
    const tx = await rpc("getTransaction", [row.signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
    const verdict = verifyReferencedUsdcPayment(tx, { recipient: to, mint: USDC_MINT.toBase58(), cents });
    if (verdict.paid) return { ...verdict, signature: row.signature };
    last = verdict;
  }
  return last;
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

async function latestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const result = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as {
    value?: { blockhash?: string; lastValidBlockHeight?: number };
  };
  const hash = result?.value?.blockhash;
  const last = result?.value?.lastValidBlockHeight;
  if (!hash || !Number.isSafeInteger(last)) throw new Error("No blockhash.");
  return { blockhash: hash, lastValidBlockHeight: last as number };
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
 */
export async function payUsdc(input: { owner: string; to: string; cents?: number; usd?: number; memo?: string }): Promise<{ signature: string; reference: string }> {
  return withWalletExecutionLock(input.owner, async () => {
  let owner: PublicKey;
  let to: PublicKey;
  let cents: number;
  let raw: bigint;
  try {
    cents = typeof input.cents === "number" ? assertCents(input.cents) : usdNumberToCents(input.usd as number);
    const capCents = Math.round(spendCap() * 100);
    if (cents > capCents) throw new Error(`That is over the spend cap of ${spendCap()}. Raise it on the wallet, or send less.`);
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
  return { signature, reference: reference.toBase58() };
  });
}

/** Check the journal and the chain before a retry is allowed after an uncertain send. */
export function checkUsdcSendRecovery(owner: string, signature: string | null) {
  return checkSendRecovery({ storage: window.localStorage, owner, rpc, signature });
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
