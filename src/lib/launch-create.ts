/** A coin create the wallet signs. The mint key exists only until that signature. It is not stored. */

import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { sendPartial } from "@/lib/phantom";

const KEY = "senda.launch.drafts.v1";

export type LaunchDraft = {
  id: string;
  chain: "solana" | "robinhood";
  name: string;
  symbol: string;
  description: string;
  uri: string;
  sol: number;
  supply: string;
  pool: "pump" | "bonk";
  at: string;
  status: "held" | "launched";
  mint?: string;
  sig?: string;
};

function read(): LaunchDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as LaunchDraft[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function write(rows: LaunchDraft[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 24)));
}

export function listDrafts(): LaunchDraft[] {
  return read();
}

export function holdDraft(input: Omit<LaunchDraft, "id" | "at" | "status" | "mint" | "sig">): LaunchDraft | { error: string } {
  const name = input.name.trim();
  const symbol = input.symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (name.length < 2) return { error: "Name the coin." };
  if (symbol.length < 2 || symbol.length > 10) return { error: "The ticker is 2 to 10 letters." };
  if (input.chain === "solana" && !(input.sol >= 0.001 && input.sol <= 5)) return { error: "The first buy is between 0.001 and 5 SOL." };
  const row: LaunchDraft = {
    ...input,
    name: name.slice(0, 32),
    symbol,
    description: input.description.trim().slice(0, 200),
    uri: input.uri.trim(),
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    status: "held",
  };
  write([row, ...read()]);
  return row;
}

export function dropDraft(id: string) {
  write(read().filter((row) => row.id !== id || row.status === "launched"));
}

function mark(id: string, mint: string, sig: string) {
  write(read().map((row) => (row.id === id ? { ...row, status: "launched" as const, mint, sig } : row)));
}

async function metadataUri(draft: LaunchDraft): Promise<string> {
  if (/^https:\/\/\S+$/.test(draft.uri)) return draft.uri;
  const form = new FormData();
  form.set("name", draft.name);
  form.set("symbol", draft.symbol);
  form.set("description", draft.description || draft.name);
  form.set("showName", "true");
  const res = await fetch("https://pump.fun/api/ipfs", { method: "POST", body: form });
  if (!res.ok) {
    throw new Error("Pump did not take the metadata. Paste a metadata link, or leave the draft and try again. Nothing was created.");
  }
  const body = (await res.json()) as { metadataUri?: string };
  if (!body.metadataUri) throw new Error("Pump did not return a metadata link. Nothing was created.");
  return body.metadataUri;
}

/** Pump or Bonk builds the create. The mint key signs first. Phantom signs second. */
export async function createOnSolana(owner: string, draft: LaunchDraft): Promise<{ mint: string; signature: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("The network is down. The draft stays on this phone.");
  }
  const uri = await metadataUri(draft);
  const mint = Keypair.generate();
  const res = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/octet-stream" },
    body: JSON.stringify({
      publicKey: owner,
      action: "create",
      tokenMetadata: { name: draft.name, symbol: draft.symbol, uri },
      mint: mint.publicKey.toBase58(),
      denominatedInSol: "true",
      amount: draft.sol,
      slippage: 10,
      priorityFee: 0.00005,
      pool: draft.pool,
    }),
  });
  if (!res.ok) {
    const text = (await res.text()).trim();
    throw new Error(text || `The pool did not build the create (${res.status}). The draft is still here.`);
  }
  const tx = VersionedTransaction.deserialize(new Uint8Array(await res.arrayBuffer()));
  tx.sign([mint]);
  const signature = await sendPartial(tx);
  const address = mint.publicKey.toBase58();
  mark(draft.id, address, signature);
  return { mint: address, signature };
}
