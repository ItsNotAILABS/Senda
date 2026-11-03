/**
 * A gift is a fresh keypair whose secret lives in the link hash and in the sender's browser.
 * The server never sees it. The vault pays the claim fee. Expiry is enforced by this page, not a program:
 * anyone who already has the link can still move the USDC.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { broadcastSigned, signAndBroadcast } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SOL_FEE = 8_000_000;
const STORE = "senda.gift.vaults.v1";

export type GiftRecord = {
  pubkey: string;
  secret: string;
  usd: number;
  memo: string;
  expiresAt: number;
  createdAt: number;
  status: "open" | "reclaimed" | "claimed";
};

export type GiftPayload = { secret: Uint8Array; expiresAt: number; usd: number; memo: string };

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
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
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), USDC_MINT.toBuffer()], ATA_PROGRAM)[0];
}

function transferData(amount: bigint): Uint8Array {
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

function createAtaIx(payer: PublicKey, owner: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: ATA_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata(owner), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });
}

function usdcIx(owner: PublicKey, destOwner: PublicKey, raw: bigint): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN,
    keys: [
      { pubkey: ata(owner), isSigner: false, isWritable: true },
      { pubkey: ata(destOwner), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(transferData(raw)),
  });
}

export function secretBytes(secret: string): Uint8Array {
  return fromB64url(secret);
}

export function loadGifts(): GiftRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "[]") as GiftRecord[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeGifts(rows: GiftRecord[]) {
  localStorage.setItem(STORE, JSON.stringify(rows));
}

export function saveGift(row: GiftRecord) {
  const rows = loadGifts().filter((g) => g.pubkey !== row.pubkey);
  rows.unshift(row);
  writeGifts(rows.slice(0, 30));
}

export function markGift(pubkey: string, status: GiftRecord["status"]) {
  writeGifts(loadGifts().map((g) => (g.pubkey === pubkey ? { ...g, status } : g)));
}

export function giftLink(secret: Uint8Array, expiresAt: number, usd: number, memo: string): string {
  const body = b64url(
    new TextEncoder().encode(JSON.stringify({ s: b64url(secret), e: expiresAt, u: usd, m: memo.slice(0, 80) })),
  );
  return `/gift#${body}`;
}

export function readGiftHash(hash: string): GiftPayload | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromB64url(raw))) as { s?: string; e?: number; u?: number; m?: string };
    if (!parsed.s) return null;
    const secret = fromB64url(parsed.s);
    if (secret.length !== 64) return null;
    return { secret, expiresAt: Number(parsed.e) || 0, usd: Number(parsed.u) || 0, memo: String(parsed.m || "") };
  } catch {
    return null;
  }
}

export function newGift(usd: number, memo: string, hours: number): { record: GiftRecord; link: string } {
  const kp = Keypair.generate();
  const expiresAt = Date.now() + Math.max(1, hours) * 60 * 60 * 1000;
  const secret = kp.secretKey;
  const record: GiftRecord = {
    pubkey: kp.publicKey.toBase58(),
    secret: b64url(secret),
    usd,
    memo: memo.slice(0, 80),
    expiresAt,
    createdAt: Date.now(),
    status: "open",
  };
  return { record, link: giftLink(secret, expiresAt, usd, record.memo) };
}

/** Sender signs. USDC and a little SOL land on the vault. The vault can pay the claim. */
export async function fundGift(input: { owner: string; vault: string; usd: number; memo: string }): Promise<string> {
  const usd = Math.round(input.usd * 100) / 100;
  if (!(usd > 0)) throw new Error("Enter an amount.");
  const cap = spendCap();
  if (usd > cap) throw new Error(`That is over the spend cap of ${cap}.`);
  let owner: PublicKey;
  let vault: PublicKey;
  try {
    owner = new PublicKey(input.owner);
    vault = new PublicKey(input.vault);
  } catch {
    throw new Error("That is not a Solana address.");
  }
  const source = ata(owner);
  if (!(await accountExists(source))) throw new Error("This wallet has no USDC account.");
  const raw = BigInt(Math.round(usd * 1_000_000));
  const ix: TransactionInstruction[] = [
    SystemProgram.transfer({ fromPubkey: owner, toPubkey: vault, lamports: SOL_FEE }),
  ];
  if (!(await accountExists(ata(vault)))) ix.push(createAtaIx(owner, vault));
  ix.push(usdcIx(owner, vault, raw));
  ix.push(
    new TransactionInstruction({
      programId: MEMO,
      keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
      data: Buffer.from(new TextEncoder().encode(`Senda gift ${usd} ${input.memo}`.slice(0, 80))),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  return signAndBroadcast(tx);
}

/** Vault signs. Recipient pays no fee. Destination is any Solana address. */
export async function sweepGift(input: { secret: Uint8Array; to: string }): Promise<string> {
  const vault = Keypair.fromSecretKey(input.secret);
  let to: PublicKey;
  try {
    to = new PublicKey(input.to.trim());
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (vault.publicKey.equals(to)) throw new Error("Send it to someone else.");
  const source = ata(vault.publicKey);
  if (!(await accountExists(source))) throw new Error("This vault has no USDC yet.");
  const bal = (await rpc("getTokenAccountBalance", [source.toBase58()])) as { value?: { amount?: string } };
  const raw = BigInt(bal?.value?.amount || "0");
  if (raw <= 0n) throw new Error("This vault is empty.");
  const ix: TransactionInstruction[] = [];
  if (!(await accountExists(ata(to)))) ix.push(createAtaIx(vault.publicKey, to));
  ix.push(usdcIx(vault.publicKey, to, raw));
  const tx = new Transaction();
  tx.feePayer = vault.publicKey;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  tx.sign(vault);
  return broadcastSigned(tx);
}
