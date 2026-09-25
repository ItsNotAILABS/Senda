/**
 * Pay a Solana address in USDC. The wallet signs. Senda does not hold the key.
 * This is the spend a merchant on Solana can clear. It is not a Visa number.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { broadcastSigned, phantomProvider } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";
import { activeSolProvider } from "@/lib/wallets";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

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
export async function payUsdc(input: { owner: string; to: string; usd: number; memo?: string }): Promise<{ signature: string; reference: string }> {
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
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  const provider = (activeSolProvider() as ReturnType<typeof phantomProvider>) ?? phantomProvider();
  if (!provider?.signTransaction) throw new Error("Connect a Solana wallet in this window. It has to sign.");
  const signed = await provider.signTransaction(tx);
  const signature = await broadcastSigned(signed);
  return { signature, reference: reference.toBase58() };
}
