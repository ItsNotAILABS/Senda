/**
 * A USDC pot whose key stays on this device.
 * Anyone can pay the address. This device signs the payout. Senda never sees the key.
 * The person holding the device can pay any address. That is the trust line.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createServerFn } from "@tanstack/react-start";
import { broadcastSigned } from "@/lib/phantom";

const KEY = "senda.table.v1";
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SOL = "So11111111111111111111111111111111111111112";

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

export function tableAddress(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(KEY);
  if (raw) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[])).publicKey.toBase58();
  const kp = Keypair.generate();
  window.localStorage.setItem(KEY, JSON.stringify(Array.from(kp.secretKey)));
  return kp.publicKey.toBase58();
}

function tableKey(): Keypair {
  const raw = window.localStorage.getItem(KEY);
  if (!raw) tableAddress();
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(window.localStorage.getItem(KEY) || "[]") as number[]));
}

function ata(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}

export async function tableBalances(): Promise<{ usdc: number; sol: number }> {
  const owner = tableKey().publicKey;
  const [sol, token] = await Promise.all([
    rpc("getBalance", [owner.toBase58(), { commitment: "confirmed" }]) as Promise<{ value?: number }>,
    rpc("getTokenAccountBalance", [ata(owner, USDC).toBase58(), { commitment: "confirmed" }]).catch(() => null) as Promise<{
      value?: { uiAmount?: number | null };
    } | null>,
  ]);
  return { usdc: token?.value?.uiAmount || 0, sol: (sol?.value || 0) / 1e9 };
}

/** Pay `usd` of the pot's USDC to `to`. Signed by the table key on this device. */
export async function settleTable(to: string, usd: number, memo: string): Promise<string> {
  const amount = Math.round(usd * 100) / 100;
  if (!(amount > 0)) throw new Error("The pot has nothing to pay.");
  const kp = tableKey();
  let destOwner: PublicKey;
  try {
    destOwner = new PublicKey(to.trim());
  } catch {
    throw new Error("That is not a Solana address.");
  }
  if (kp.publicKey.equals(destOwner)) throw new Error("Pay a player, not the pot.");
  const source = ata(kp.publicKey, USDC);
  const sourceInfo = (await rpc("getAccountInfo", [source.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  if (!sourceInfo?.value) throw new Error("The pot has no USDC yet.");
  const dest = ata(destOwner, USDC);
  const destInfo = (await rpc("getAccountInfo", [dest.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  const hash = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  const raw = BigInt(Math.round(amount * 1_000_000));
  const ix: TransactionInstruction[] = [];
  if (!destInfo?.value) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: kp.publicKey, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: destOwner, isSigner: false, isWritable: false },
          { pubkey: USDC, isSigner: false, isWritable: false },
          { pubkey: SYSTEM, isSigner: false, isWritable: false },
          { pubkey: TOKEN, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  const data = new Uint8Array(9);
  data[0] = 3;
  new DataView(data.buffer).setBigUint64(1, raw, true);
  ix.push(
    new TransactionInstruction({
      programId: TOKEN,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: kp.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(data),
    }),
    new TransactionInstruction({
      programId: MEMO,
      keys: [{ pubkey: kp.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(new TextEncoder().encode(memo.slice(0, 80))),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = kp.publicKey;
  tx.recentBlockhash = hash.value.blockhash;
  tx.add(...ix);
  tx.sign(kp);
  return broadcastSigned(tx);
}

export const readSolPrice = createServerFn({ method: "GET" }).handler(async (): Promise<{ usd: number }> => {
  const res = await fetch(`https://api.jup.ag/price/v3?ids=${SOL}`, { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
  if (!res.ok) return { usd: 0 };
  const body = (await res.json()) as Record<string, { usdPrice?: number }>;
  return { usd: Number(body[SOL]?.usdPrice) || 0 };
});
