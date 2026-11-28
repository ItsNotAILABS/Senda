/**
 * A hold is a Solana address. USDC and shares sit in its token accounts.
 * The key stays in this browser. Phantom pays the network fee when the hold signs.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { transferData, USDC_MINT } from "@/lib/chain-codec";
import { broadcastSigned, chainRpc, invalidateChain, requirePhantom, splHolding } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const USDC = new PublicKey(USDC_MINT);
const BOOK = "senda.hold.book.v1";
const KEYS = "senda.hold.keys.v1";

export type HoldKind = "pay" | "gift" | "invest";

export type Hold = {
  id: string;
  name: string;
  purpose: string;
  kind: HoldKind;
  created: number;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "") as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function keys(): Record<string, number[]> {
  const rows = readJson<Record<string, number[]>>(KEYS, {});
  return rows && typeof rows === "object" ? rows : {};
}

export function listHolds(): Hold[] {
  const rows = readJson<Hold[]>(BOOK, []);
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({ ...row, kind: row.kind || "pay" }));
}

function saveHolds(rows: Hold[]) {
  window.localStorage.setItem(BOOK, JSON.stringify(rows));
}

function holdKey(pub: string): Keypair {
  const secret = keys()[pub];
  if (!secret?.length) throw new Error("This browser does not have the key for that contract.");
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function createHold(name: string, purpose: string, kind: HoldKind = "pay"): Hold {
  void name;
  void purpose;
  void kind;
  throw new Error("A contract does not get a key in this browser. Pay from the wallet you sign with. An old contract can still be swept.");
}

function ata(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}

async function accountExists(address: PublicKey): Promise<boolean> {
  const result = (await chainRpc("getAccountInfo", [address.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  return Boolean(result?.value);
}

async function hash(): Promise<string> {
  const result = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  const blockhash = result?.value?.blockhash;
  if (!blockhash) throw new Error("No blockhash.");
  return blockhash;
}

async function moveSpl(input: {
  mint: PublicKey;
  from: PublicKey;
  to: PublicKey;
  amount: bigint;
  feePayer: PublicKey;
  authority: PublicKey;
  extra?: Keypair;
}): Promise<string> {
  if (input.amount <= 0n) throw new Error("Nothing to move.");
  const source = ata(input.from, input.mint);
  const dest = ata(input.to, input.mint);
  const ix: TransactionInstruction[] = [];
  if (!(await accountExists(dest))) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: input.feePayer, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: input.to, isSigner: false, isWritable: false },
          { pubkey: input.mint, isSigner: false, isWritable: false },
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
        { pubkey: input.authority, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(transferData(input.amount)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = input.feePayer;
  tx.recentBlockhash = await hash();
  tx.add(...ix);
  if (input.extra) tx.partialSign(input.extra);
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  const sig = await broadcastSigned(signed);
  invalidateChain(input.from.toBase58());
  invalidateChain(input.to.toBase58());
  return sig;
}

export async function putUsdc(owner: string, hold: string, usd: number): Promise<string> {
  const { payUsdc } = await import("@/lib/solana-pay");
  const paid = await payUsdc({ owner, to: hold, usd, memo: "Senda hold" });
  invalidateChain(hold);
  invalidateChain(owner);
  return paid.signature;
}

export async function putShares(owner: string, hold: string, mint: string): Promise<string> {
  const held = await splHolding(owner, mint);
  if (!held || BigInt(held.raw) <= 0n) throw new Error("This Phantom holds none of that token.");
  return moveSpl({
    mint: new PublicKey(mint),
    from: new PublicKey(owner),
    to: new PublicKey(hold),
    amount: BigInt(held.raw),
    feePayer: new PublicKey(owner),
    authority: new PublicKey(owner),
  });
}

export async function payFromHold(hold: string, to: string, usd: number, feePayer: string): Promise<string> {
  const atoms = BigInt(Math.round(usd * 1_000_000));
  const have = await splHolding(hold, USDC_MINT);
  if (BigInt(have.raw || "0") < atoms) throw new Error("The contract does not hold that much USDC.");
  const vault = holdKey(hold);
  return moveSpl({
    mint: USDC,
    from: vault.publicKey,
    to: new PublicKey(to),
    amount: atoms,
    feePayer: new PublicKey(feePayer),
    authority: vault.publicKey,
    extra: vault,
  });
}

export async function sendShares(hold: string, to: string, mint: string, feePayer: string): Promise<string> {
  const have = await splHolding(hold, mint);
  if (BigInt(have.raw || "0") <= 0n) throw new Error("The contract does not hold that token.");
  const vault = holdKey(hold);
  return moveSpl({
    mint: new PublicKey(mint),
    from: vault.publicKey,
    to: new PublicKey(to),
    amount: BigInt(have.raw),
    feePayer: new PublicKey(feePayer),
    authority: vault.publicKey,
    extra: vault,
  });
}

export async function buyIntoHold(input: {
  hold: string;
  owner: string;
  mint: string;
  usd: number;
  price?: number;
}): Promise<{ bought: string; parked: string }> {
  const before = BigInt((await splHolding(input.owner, input.mint)).raw || "0");
  const bought = await runPrestock({
    owner: input.owner,
    mint: input.mint,
    side: "buy",
    usd: input.usd,
    price: input.price,
  });
  const after = await splHolding(input.owner, input.mint);
  const delta = BigInt(after.raw || "0") - before;
  if (delta <= 0n) throw new Error("Jupiter signed, but the new shares were not in Phantom yet. Put them in from the contract once they show.");
  const parked = await moveSpl({
    mint: new PublicKey(input.mint),
    from: new PublicKey(input.owner),
    to: new PublicKey(input.hold),
    amount: delta,
    feePayer: new PublicKey(input.owner),
    authority: new PublicKey(input.owner),
  });
  return { bought: bought.signature, parked };
}
