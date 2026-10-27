/**
 * A key this browser holds signs a Jupiter swap and pays the fee.
 * Phantom is not asked. The key must hold the token and a little SOL.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { chainRpc, confirmSig } from "@/lib/phantom";

const QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const SWAP = "https://lite-api.jup.ag/swap/v1/swap";
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export async function lamports(owner: string): Promise<number> {
  const result = (await chainRpc("getBalance", [owner, { commitment: "confirmed" }])) as { value?: number };
  return result?.value || 0;
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function selfSwap(
  kp: Keypair,
  input: { inputMint: string; outputMint: string; amountRaw: number; maxImpact?: number },
): Promise<{ signature: string; outAmount: string }> {
  if (!(input.amountRaw > 0)) throw new Error("Nothing to swap.");
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=80&restrictIntermediateTokens=true`;
  const qres = await fetch(`${QUOTE}?${qs}`, { headers: { accept: "application/json" } });
  const quote = (await qres.json()) as { outAmount?: string; priceImpactPct?: string; error?: string };
  if (!qres.ok || !quote.outAmount) throw new Error(quote.error || "Jupiter did not quote.");
  const impact = Math.abs(Number(quote.priceImpactPct || 0));
  const cap = input.maxImpact ?? 0.5;
  if (impact > cap) throw new Error(`Impact is ${impact.toFixed(2)}%. Not sent.`);
  const sres = await fetch(SWAP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: kp.publicKey.toBase58(),
      dynamicComputeUnitLimit: true,
      wrapAndUnwrapSol: true,
    }),
  });
  const built = (await sres.json()) as { swapTransaction?: string; error?: string };
  if (!built.swapTransaction) throw new Error(built.error || "Jupiter did not build the swap.");
  const tx = VersionedTransaction.deserialize(Buffer.from(built.swapTransaction, "base64"));
  tx.sign([kp]);
  const sig = (await chainRpc("sendTransaction", [b64(tx.serialize()), { encoding: "base64", skipPreflight: false, maxRetries: 2 }])) as unknown;
  if (typeof sig !== "string") throw new Error("RPC did not return a signature.");
  await confirmSig(sig);
  return { signature: sig, outAmount: quote.outAmount };
}

async function mintProgram(mint: PublicKey): Promise<PublicKey> {
  const result = (await chainRpc("getAccountInfo", [mint.toBase58(), { encoding: "base64" }])) as { value?: { owner?: string } | null };
  return result?.value?.owner === TOKEN_2022.toBase58() ? TOKEN_2022 : TOKEN;
}

function ata(owner: PublicKey, mint: PublicKey, program: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), program.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}

async function exists(address: PublicKey): Promise<boolean> {
  const result = (await chainRpc("getAccountInfo", [address.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  return Boolean(result?.value);
}

async function hash(): Promise<string> {
  const result = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  const blockhash = result?.value?.blockhash;
  if (!blockhash) throw new Error("No blockhash.");
  return blockhash;
}

/** Move a token from a browser key. The key pays the fee. */
export async function sendFromKey(kp: Keypair, input: { mint: PublicKey; to: string; raw: bigint; decimals: number }): Promise<string> {
  if (input.raw <= 0n) throw new Error("Nothing to send.");
  const program = await mintProgram(input.mint);
  const source = ata(kp.publicKey, input.mint, program);
  const destOwner = new PublicKey(input.to);
  const dest = ata(destOwner, input.mint, program);
  const ix: TransactionInstruction[] = [];
  if (!(await exists(dest))) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: kp.publicKey, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: destOwner, isSigner: false, isWritable: false },
          { pubkey: input.mint, isSigner: false, isWritable: false },
          { pubkey: SYSTEM, isSigner: false, isWritable: false },
          { pubkey: program, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }),
    );
  }
  const data = Buffer.alloc(9);
  data[0] = 3;
  data.writeBigUInt64LE(input.raw, 1);
  ix.push(
    new TransactionInstruction({
      programId: program,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: kp.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    }),
  );
  const tx = new Transaction();
  tx.feePayer = kp.publicKey;
  tx.recentBlockhash = await hash();
  tx.add(...ix);
  tx.sign(kp);
  const sig = (await chainRpc("sendTransaction", [b64(tx.serialize()), { encoding: "base64", skipPreflight: false }])) as unknown;
  if (typeof sig !== "string") throw new Error("RPC did not return a signature.");
  await confirmSig(sig);
  return sig;
}

export async function sendUsdcFromKey(kp: Keypair, to: string, usd: number): Promise<string> {
  const raw = BigInt(Math.round(usd * 1_000_000));
  return sendFromKey(kp, { mint: USDC, to, raw, decimals: 6 });
}
