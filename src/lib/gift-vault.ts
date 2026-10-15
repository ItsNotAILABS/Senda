/**
 * A gift vault is a temporary key made in this browser.
 * The sender funds it. The vault key pays the claim fee, so the recipient spends no SOL.
 * The secret is the URL hash and this tab. It is not sent to Senda.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { giftHash, giftOpen } from "@/lib/gift-link.mjs";
import { broadcastSigned, phantomProvider } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";
import { activeSolProvider } from "@/lib/wallets";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SESSION = "senda.gift.session";

/** Enough SOL for the vault to create the recipient account and pay the fee. */
export const VAULT_LAMPORTS = 3_000_000n;

export type HeldGift = { vault: string; secret: string; expiresAt: number; usd: number; signature: string };

function rpc(method: string, params: unknown[]): Promise<unknown> {
  const urls = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
  return (async () => {
    let last = "RPC failed";
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
        if (body.error) {
          last = body.error.message || last;
          continue;
        }
        return body.result;
      } catch (error) {
        last = error instanceof Error ? error.message : last;
      }
    }
    throw new Error(last);
  })();
}

function ata(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), USDC_MINT.toBuffer()], ATA_PROGRAM)[0];
}

function u64(amount: bigint): Uint8Array {
  const data = new Uint8Array(9);
  data[0] = 3;
  new DataView(data.buffer).setBigUint64(1, amount, true);
  return data;
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

function keyFromSecret(secret: string): Keypair {
  const raw = Buffer.from(secret, "base64url");
  if (raw.length !== 64) throw new Error("That gift key is not a Solana key.");
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

function createAta(payer: PublicKey, owner: PublicKey, dest: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: ATA_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: SYSTEM, isSigner: false, isWritable: false },
      { pubkey: TOKEN, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });
}

function transferUsdc(source: PublicKey, dest: PublicKey, authority: PublicKey, raw: bigint): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(u64(raw)),
  });
}

function transferSol(from: PublicKey, to: PublicKey, lamports: bigint): TransactionInstruction {
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2, 0);
  data.writeBigUInt64LE(lamports, 4);
  return new TransactionInstruction({
    programId: SYSTEM,
    keys: [
      { pubkey: from, isSigner: true, isWritable: true },
      { pubkey: to, isSigner: false, isWritable: true },
    ],
    data,
  });
}

async function walletSign(tx: Transaction): Promise<{ serialize: () => Uint8Array }> {
  const provider = (activeSolProvider() as ReturnType<typeof phantomProvider>) ?? phantomProvider();
  if (!provider?.signTransaction) throw new Error("Connect a Solana wallet in this window. It has to sign.");
  return provider.signTransaction(tx);
}

export function rememberGift(row: HeldGift) {
  const prior = loadGifts().filter((gift) => gift.vault !== row.vault);
  sessionStorage.setItem(SESSION, JSON.stringify([row, ...prior].slice(0, 8)));
}

export function loadGifts(): HeldGift[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const rows = JSON.parse(sessionStorage.getItem(SESSION) || "[]") as HeldGift[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function giftLink(input: { secret: string; expiresAt: number; usd: number }): string {
  const path = `${window.location.origin}${window.location.pathname}`;
  return `${path}#${giftHash(input)}`;
}

/** Sender signs. The new key receives USDC plus a little SOL for the later fee. */
export async function fundGift(input: { owner: string; usd: number; hours: number }): Promise<HeldGift & { link: string }> {
  const usd = Math.round(input.usd * 100) / 100;
  if (!(usd > 0)) throw new Error("Enter an amount.");
  const cap = spendCap();
  if (usd > cap) throw new Error(`That is over the spend cap of ${cap}.`);
  const owner = new PublicKey(input.owner);
  const source = ata(owner);
  if (!(await accountExists(source))) throw new Error("This wallet has no USDC account.");
  const vault = Keypair.generate();
  const secret = Buffer.from(vault.secretKey).toString("base64url");
  const dest = ata(vault.publicKey);
  const raw = BigInt(Math.round(usd * 1_000_000));
  const ix = [
    transferSol(owner, vault.publicKey, VAULT_LAMPORTS),
    createAta(owner, vault.publicKey, dest),
    transferUsdc(source, dest, owner, raw),
  ];
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const signed = await walletSign(tx);
  const signature = await broadcastSigned(signed);
  const expiresAt = Date.now() + Math.max(1, input.hours) * 3_600_000;
  const held = { vault: vault.publicKey.toBase58(), secret, expiresAt, usd, signature };
  rememberGift(held);
  return { ...held, link: giftLink(held) };
}

async function sweep(input: { secret: string; to: string; usd: number }): Promise<string> {
  const vault = keyFromSecret(input.secret);
  const to = new PublicKey(input.to);
  if (vault.publicKey.equals(to)) throw new Error("Send it to a different wallet.");
  const source = ata(vault.publicKey);
  const dest = ata(to);
  const raw = BigInt(Math.round(input.usd * 1_000_000));
  const ix: TransactionInstruction[] = [];
  if (!(await accountExists(dest))) ix.push(createAta(vault.publicKey, to, dest));
  ix.push(transferUsdc(source, dest, vault.publicKey, raw));
  const tx = new Transaction();
  tx.feePayer = vault.publicKey;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  tx.sign(vault);
  return broadcastSigned(tx);
}

/** Recipient names a wallet. They do not sign and they do not pay the fee. */
export async function claimGift(input: { secret: string; expiresAt: number; to: string; usd: number }): Promise<string> {
  if (!giftOpen(Date.now(), input.expiresAt)) throw new Error("This window has closed. The sender can reclaim it.");
  return sweep(input);
}

/** Sender takes an unspent vault back. The same temporary key pays the fee. */
export async function reclaimGift(input: { secret: string; to: string; usd: number }): Promise<string> {
  return sweep(input);
}
