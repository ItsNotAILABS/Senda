/** What a confirmed swap actually spent, read off the transaction. */

import { chainRpc } from "@/lib/phantom";

const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

export type SolSpend = {
  fee: number;
  rent: number;
  total: number;
  ataNew: boolean;
};

type TxMeta = {
  meta?: {
    fee?: number;
    err?: unknown;
    preBalances?: number[];
    postBalances?: number[];
    logMessages?: string[];
  };
  transaction?: {
    message?: {
      accountKeys?: Array<string | { pubkey?: string }>;
      instructions?: Array<{ programId?: string; parsed?: { type?: string } }>;
    };
  };
};

function keyAt(tx: TxMeta, i: number): string {
  const k = tx.transaction?.message?.accountKeys?.[i];
  if (typeof k === "string") return k;
  return k?.pubkey || "";
}

/** Network fee versus one-time token-account rent. SOL is the fuel, not the asset bought. */
export async function readSolSpend(signature: string, owner: string): Promise<SolSpend | null> {
  const tx = (await chainRpc("getTransaction", [
    signature,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
  ])) as TxMeta | null;
  if (!tx?.meta || tx.meta.err) return null;
  const feeLamports = Number(tx.meta.fee) || 0;
  const keys = tx.transaction?.message?.accountKeys ?? [];
  let idx = 0;
  for (let i = 0; i < keys.length; i += 1) {
    if (keyAt(tx, i) === owner) {
      idx = i;
      break;
    }
  }
  const pre = Number(tx.meta.preBalances?.[idx] ?? 0);
  const post = Number(tx.meta.postBalances?.[idx] ?? 0);
  const spent = Math.max(0, pre - post);
  const fee = feeLamports / 1e9;
  const rentLamports = Math.max(0, spent - feeLamports);
  const logs = tx.meta.logMessages ?? [];
  const ix = tx.transaction?.message?.instructions ?? [];
  const created =
    ix.some((row) => row.programId === ATA || /create/i.test(row.parsed?.type || "")) ||
    logs.some((line) => line.includes(ATA) || /CreateIdempotent|InitializeAccount/i.test(line));
  const ataNew = created && rentLamports > 100_000;
  return {
    fee,
    rent: ataNew ? rentLamports / 1e9 : 0,
    total: spent / 1e9,
    ataNew,
  };
}
