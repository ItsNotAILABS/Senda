/** Fund the devnet treasury. Instruction 1 only. Mainnet is never asked. Draw is not built. */

import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { connectPhantom, phantomProvider, waitForInjected } from "@/lib/phantom";
import { fundData, TREASURY_PROGRAM_ID } from "@/lib/treasury-ix";

const DEVNET = "https://api.devnet.solana.com";

async function devnet(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(DEVNET, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || "Devnet refused.");
  return json.result ?? null;
}

export function treasuryAddress(authority: PublicKey, programId = new PublicKey(TREASURY_PROGRAM_ID)): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury"), authority.toBuffer()], programId)[0];
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** Init if the account is missing, then instruction 1. No arm. No draw. */
export function fundTransaction(args: { owner: PublicKey; lamports: bigint; blockhash: string; needsInit: boolean }): Transaction {
  const data = fundData(args.lamports);
  if (!data) throw new Error("A fund of zero is rejected. Nothing was sent.");
  const programId = new PublicKey(TREASURY_PROGRAM_ID);
  const treasury = treasuryAddress(args.owner, programId);
  const tx = new Transaction({ feePayer: args.owner, recentBlockhash: args.blockhash });
  if (args.needsInit) {
    tx.add(new TransactionInstruction({
      programId,
      keys: [
        { pubkey: args.owner, isSigner: true, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Uint8Array.of(0),
    }));
  }
  tx.add(new TransactionInstruction({
    programId,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  }));
  return tx;
}

export async function fundTreasury(owner: string, sol: number): Promise<{ signature: string; treasury: string }> {
  if (!(sol > 0) || sol > 2) throw new Error("Fund from a fraction of a SOL up to 2, on devnet only.");
  const lamports = BigInt(Math.round(sol * 1_000_000_000));
  const who = new PublicKey(owner);
  const programId = new PublicKey(TREASURY_PROGRAM_ID);
  const program = (await devnet("getAccountInfo", [programId.toBase58(), { encoding: "base64" }])) as { value?: { executable?: boolean } | null };
  if (!program?.value?.executable) throw new Error("The treasury program is not on devnet. Nothing was sent.");
  const treasury = treasuryAddress(who, programId);
  const existing = (await devnet("getAccountInfo", [treasury.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  const balance = (await devnet("getBalance", [owner, { commitment: "confirmed" }])) as { value?: number };
  const have = balance?.value ?? 0;
  if (have < Number(lamports) + 20_000_000) {
    throw new Error("This wallet needs devnet SOL from faucet.solana.com. The public RPC faucet is closed. Nothing was sent.");
  }
  const hash = (await devnet("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("Devnet did not return a blockhash.");
  const tx = fundTransaction({ owner: who, lamports, blockhash: hash.value.blockhash, needsInit: !existing?.value });
  const injected = phantomProvider() ?? (await waitForInjected());
  const signer = injected?.signTransaction ? injected : null;
  if (!signer?.signTransaction) {
    await connectPhantom();
    throw new Error("Open Phantom on devnet and try the fund again. Nothing was sent.");
  }
  const signed = await signer.signTransaction(tx);
  const raw = bytesToBase64(signed.serialize());
  const sig = await devnet("sendTransaction", [raw, { encoding: "base64", skipPreflight: false }]);
  if (typeof sig !== "string") throw new Error("Devnet did not return a signature.");
  return { signature: sig, treasury: treasury.toBase58() };
}
