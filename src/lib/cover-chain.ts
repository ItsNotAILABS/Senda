/**
 * A cover is a transaction. Premium USDC leaves Phantom into a cover account.
 * The key for that account stays in this browser so a settle can pay it back.
 * Senda does not print the payout.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { phantomProvider, broadcastSigned, splHolding } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const BOOK = "senda.cover.chain.v1";
const KP = "senda.cover.kp.v1";

export type ChainCover = {
  id: string;
  sig: string;
  kind: "drop" | "life";
  title: string;
  symbol: string;
  mint: string;
  strike: number;
  cover: number;
  premium: number;
  until: number;
  status: "open" | "settled" | "cancelled";
};

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

export function coverPubkey(): string {
  return coverKey().publicKey.toBase58();
}

function coverKey(): Keypair {
  const raw = typeof window === "undefined" ? "" : window.localStorage.getItem(KP) || "";
  if (raw) {
    const secret = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  window.localStorage.setItem(KP, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
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

/** Move the premium in USDC and write the terms in a memo. You sign. */
export async function openChainCover(input: {
  owner: string;
  kind: "drop" | "life";
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
      data: Buffer.from(u64(raw)),
    }),
  );
  const memo = `Senda cover ${input.kind} ${input.symbol || input.title} premium=${input.premium} size=${input.cover} strike=${input.strike || 0}`;
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
  const provider = phantomProvider();
  if (!provider?.signTransaction) throw new Error("Phantom has to sign the premium. Connect it in this window.");
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
  };
  save([row, ...listChainCovers()]);
  return row;
}

/** Send this cover's premium back. A drop that has fallen also asks you to sign the buy. */
export async function settleChainCover(row: ChainCover, owner: string, price: number): Promise<{ sig: string; bought?: string }> {
  if (row.status !== "open") throw new Error("That cover is already closed.");
  const hit = row.kind === "drop" && row.strike > 0 && price > 0 && price <= row.strike * 0.9;
  const expired = Date.now() > row.until;
  if (row.kind === "drop" && !hit && !expired) {
    throw new Error(`${row.symbol} has not fallen 10% from ${row.strike}. Cancel if you want the USDC back now.`);
  }
  const sig = await returnPremium(owner, row.premium);
  const next = listChainCovers().map((c) => (c.id === row.id ? { ...c, status: hit ? "settled" : "cancelled" } : c));
  save(next as ChainCover[]);
  if (hit && row.mint) {
    const bought = await runPrestock({ owner, mint: row.mint, side: "buy", usd: row.cover, price });
    return { sig, bought: bought.signature };
  }
  return { sig };
}

export async function cancelChainCover(row: ChainCover, owner: string): Promise<string> {
  if (row.status !== "open") throw new Error("That cover is already closed.");
  const sig = await returnPremium(owner, row.premium);
  save(listChainCovers().map((c) => (c.id === row.id ? { ...c, status: "cancelled" } : c)));
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
      data: Buffer.from(u64(raw)),
    }),
  );
  tx.partialSign(vault);
  const provider = phantomProvider();
  if (!provider?.signTransaction) throw new Error("Phantom has to sign the return. Connect it in this window.");
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}
