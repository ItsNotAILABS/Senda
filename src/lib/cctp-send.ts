/** Circle CCTP v2 burn on Solana. Phantom signs. The USDC is burned, not held here. */

import { Buffer } from "buffer";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { chainRpc, connectPhantom, sendPartial } from "@/lib/phantom";

const TOKEN_MESSENGER = new PublicKey("CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe");
const MESSAGE_TRANSMITTER = new PublicKey("CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC");
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const COMPUTE = new PublicKey("ComputeBudget111111111111111111111111111111");
const DISC = Buffer.from([215, 60, 61, 46, 114, 55, 128, 176]);

export const CCTP_DEST = [
  { id: "ethereum", label: "Ethereum", domain: 0 },
  { id: "base", label: "Base", domain: 6 },
  { id: "arbitrum", label: "Arbitrum", domain: 3 },
] as const;

function pda(program: PublicKey, seeds: Array<Buffer | Uint8Array>): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, program)[0];
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function u64(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function evmToPubkey(address: string): PublicKey {
  const hex = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(hex)) throw new Error("That is not an Ethereum address.");
  const body = Buffer.from(hex.slice(2), "hex");
  return new PublicKey(Buffer.concat([Buffer.alloc(12), body]));
}

async function accountData(address: PublicKey): Promise<Buffer | null> {
  const body = (await chainRpc("getAccountInfo", [address.toBase58(), { encoding: "base64" }])) as {
    value?: { data?: [string, string] } | null;
  };
  const raw = body?.value?.data?.[0];
  return raw ? Buffer.from(raw, "base64") : null;
}

export async function burnUsdc(input: { usd: number; domain: number; recipient: string }): Promise<string> {
  if (!CCTP_DEST.some((d) => d.domain === input.domain)) throw new Error("That chain is not a Circle destination from Solana.");
  const atoms = BigInt(Math.round(input.usd * 1_000_000));
  if (atoms < 10_000n) throw new Error("The burn starts at one cent.");
  const owner = new PublicKey(await connectPhantom());
  const recipient = evmToPubkey(input.recipient);
  const remote = pda(TOKEN_MESSENGER, [Buffer.from("remote_token_messenger"), Buffer.from(String(input.domain))]);
  const messenger = pda(TOKEN_MESSENGER, [Buffer.from("token_messenger")]);
  const [remoteInfo, messengerInfo] = await Promise.all([accountData(remote), accountData(messenger)]);
  if (!remoteInfo) throw new Error("Circle has no messenger for that chain.");
  if (!messengerInfo || messengerInfo.length < 177) throw new Error("Circle's messenger account did not load.");
  const minFee = messengerInfo.readUInt32LE(173);
  const fee = minFee === 0 ? 0n : (atoms * BigInt(minFee)) / 10_000_000n || 1n;
  if (fee >= atoms) throw new Error("That amount is smaller than Circle's fee.");

  const burnAccount = pda(ATA_PROGRAM, [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), USDC.toBuffer()]);
  const event = Keypair.generate();
  const data = Buffer.concat([
    DISC,
    u64(atoms),
    u32(input.domain),
    Buffer.from(recipient.toBytes()),
    Buffer.alloc(32),
    u64(fee),
    u32(2000),
  ]);
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: pda(TOKEN_MESSENGER, [Buffer.from("sender_authority")]), isSigner: false, isWritable: false },
    { pubkey: burnAccount, isSigner: false, isWritable: true },
    { pubkey: pda(TOKEN_MESSENGER, [Buffer.from("denylist_account"), owner.toBuffer()]), isSigner: false, isWritable: false },
    { pubkey: pda(MESSAGE_TRANSMITTER, [Buffer.from("message_transmitter")]), isSigner: false, isWritable: true },
    { pubkey: messenger, isSigner: false, isWritable: false },
    { pubkey: remote, isSigner: false, isWritable: false },
    { pubkey: pda(TOKEN_MESSENGER, [Buffer.from("token_minter")]), isSigner: false, isWritable: false },
    { pubkey: pda(TOKEN_MESSENGER, [Buffer.from("local_token"), USDC.toBuffer()]), isSigner: false, isWritable: true },
    { pubkey: USDC, isSigner: false, isWritable: true },
    { pubkey: event.publicKey, isSigner: true, isWritable: true },
    { pubkey: MESSAGE_TRANSMITTER, isSigner: false, isWritable: false },
    { pubkey: TOKEN_MESSENGER, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: pda(TOKEN_MESSENGER, [Buffer.from("__event_authority")]), isSigner: false, isWritable: false },
    { pubkey: TOKEN_MESSENGER, isSigner: false, isWritable: false },
  ];
  const limit = Buffer.alloc(5);
  limit[0] = 2;
  limit.writeUInt32LE(400_000, 1);
  const hash = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  const blockhash = hash.value?.blockhash;
  if (!blockhash) throw new Error("Solana did not return a blockhash.");
  const tx = new Transaction({ feePayer: owner, recentBlockhash: blockhash });
  tx.add(new TransactionInstruction({ programId: COMPUTE, keys: [], data: limit }));
  tx.add(new TransactionInstruction({ programId: TOKEN_MESSENGER, keys, data }));
  tx.partialSign(event);
  return sendPartial(tx);
}
