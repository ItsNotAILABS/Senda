/** The bytes about to be signed have to be this quote. A stale "DFlow is better" flag is not enough. */

import { AddressLookupTableAccount, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const SOL = "So11111111111111111111111111111111111111112";

const PROGRAMS = new Set([
  "11111111111111111111111111111111",
  "ComputeBudget111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH",
]);

export type DflowBound = {
  outAmount: string;
  inAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  inputMint: string;
  outputMint: string;
};

function u64le(n: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let x = n;
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(x & 255n);
    x >>= 8n;
  }
  return out;
}

function contains(hay: Uint8Array, needle: Uint8Array): boolean {
  for (let i = 0; i <= hay.length - needle.length; i += 1) {
    let ok = true;
    for (let j = 0; j < needle.length; j += 1) if (hay[i + j] !== needle[j]) ok = false;
    if (ok) return true;
  }
  return false;
}

/** Refuse unless this fresh quote still beats Jupiter and the transaction matches it. */
export async function bindDflowTx(
  input: {
    quote: DflowBound;
    transaction: string;
    owner: string;
    inputMint: string;
    outputMint: string;
    amount: number;
    jupiterOut: string;
  },
  rpc: (method: string, params: unknown[]) => Promise<unknown>,
): Promise<VersionedTransaction> {
  if (input.quote.inputMint !== input.inputMint || input.quote.outputMint !== input.outputMint) {
    throw new Error("The DFlow quote is for a different mint. The wallet was not asked to sign.");
  }
  const inn = Number(input.quote.inAmount);
  if (!(inn > 0) || Math.abs(inn - Math.floor(input.amount)) > 1) {
    throw new Error("The DFlow size does not match the ticket. The wallet was not asked to sign.");
  }
  const impact = Math.abs(Number(input.quote.priceImpactPct || 0));
  if (impact > 5) throw new Error(`DFlow impact is ${impact.toFixed(1)}%. The wallet was not asked to sign.`);
  const out = BigInt(input.quote.outAmount);
  const jup = BigInt(input.jupiterOut);
  if (out <= jup) throw new Error("DFlow no longer beats Jupiter. The wallet was not asked to sign.");
  const min = BigInt(input.quote.otherAmountThreshold);
  if (min > out || min * 10000n < out * 9950n) {
    throw new Error("The DFlow minimum is worse than the 0.5% quote. The wallet was not asked to sign.");
  }

  const raw = Uint8Array.from(atob(input.transaction), (c) => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(raw);
  const staticKeys = tx.message.staticAccountKeys.map((k) => k.toBase58());
  if (staticKeys[0] !== input.owner) throw new Error("The fee payer is not this wallet. The wallet was not asked to sign.");

  const programs = tx.message.compiledInstructions.map((ix) => staticKeys[ix.programIdIndex] || "");
  const foreign = programs.find((p) => !PROGRAMS.has(p));
  if (foreign) throw new Error(`The transaction calls ${foreign}. That program is not on this route. The wallet was not asked to sign.`);

  const needle = u64le(out);
  const found = tx.message.compiledInstructions.some((ix) => contains(ix.data, needle));
  if (!found) throw new Error("The quoted output is not in the transaction. The wallet was not asked to sign.");

  const lookups = "addressTableLookups" in tx.message ? tx.message.addressTableLookups : [];
  const tables = [];
  for (const lookup of lookups) {
    const body = (await rpc("getAccountInfo", [lookup.accountKey.toBase58(), { encoding: "base64" }])) as {
      value?: { data?: [string, string] };
    } | null;
    const b64 = body?.value?.data?.[0];
    if (!b64) throw new Error("An address table did not load. The wallet was not asked to sign.");
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    tables.push(new AddressLookupTableAccount({ key: lookup.accountKey, state: AddressLookupTableAccount.deserialize(data) }));
  }
  const accounts = tx.message.getAccountKeys({ addressLookupTableAccounts: tables });
  const keys = new Set<string>();
  for (let i = 0; i < accounts.length; i += 1) {
    const key = accounts.get(i);
    if (key) keys.add(key.toBase58());
  }
  const sourceMint = input.inputMint === SOL ? SOL : input.inputMint;
  const destMint = input.outputMint === SOL ? SOL : input.outputMint;
  const source = getAssociatedTokenAddressSync(new PublicKey(sourceMint), new PublicKey(input.owner), true).toBase58();
  const dest = getAssociatedTokenAddressSync(new PublicKey(destMint), new PublicKey(input.owner), true).toBase58();
  if (!keys.has(source)) throw new Error("The source account is not this wallet. The wallet was not asked to sign.");
  if (!keys.has(dest)) throw new Error("The output account is not this wallet. The wallet was not asked to sign.");
  return tx;
}
