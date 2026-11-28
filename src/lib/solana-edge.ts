/** Solana used as a clock, a notary, a policy, and a nonce. No USDC moves here. */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Ed25519Program,
  Keypair,
  NonceAccount,
  PublicKey,
  Secp256k1Program,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getDefaultAccountState,
  getExtensionTypes,
  getInterestBearingMintConfigState,
  getMetadataPointerState,
  getMintCloseAuthority,
  getNonTransferable,
  getPausableConfig,
  getPermanentDelegate,
  getPermissionedBurn,
  getTransferFeeConfig,
  getTransferHook,
  unpackMint,
} from "@solana/spl-token";

export const SLOT_LIFE = 150;
export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const PYUSD_MINT = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";

export const MACHINES: { name: string; id: string; role: string }[] = [
  { name: "Ed25519 verifier", id: Ed25519Program.programId.toBase58(), role: "The validator checks a signature in native code. No token moves." },
  { name: "Secp256k1 verifier", id: Secp256k1Program.programId.toBase58(), role: "The same transaction can check an Ethereum signature. This desk does not invent one." },
  { name: "Memo", id: MEMO_PROGRAM.toBase58(), role: "A signed note. The hash can live here. The account number does not." },
  { name: "Token-2022", id: TOKEN_2022_PROGRAM_ID.toBase58(), role: "A mint can carry a hook, a fee, a delegate, a pause, or a hidden amount." },
  { name: "Address lookup", id: AddressLookupTableProgram.programId.toBase58(), role: "A transaction names a table instead of repeating every account." },
  { name: "Compute budget", id: ComputeBudgetProgram.programId.toBase58(), role: "The fee market prices compute units, not just the signature." },
];

export function edgePreimage(input: { actor: "mexico" | "brazil"; corridor: string; usd: number; name: string; concept: string; key: string; slot: number }): string {
  return ["senda.edge.1", input.actor, input.corridor, String(input.usd), input.name, input.concept, input.key, String(input.slot)].join("\n");
}

export function edgeHash(preimage: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(preimage)));
}

/** What is allowed on the cluster. The account number is not in this line. */
export function chainLine(actor: "mexico" | "brazil", hash: string, slot: number): string {
  return `senda.edge.1 ${actor} ${hash} slot ${slot}`;
}

export function actorPda(owner: string, actor: "mexico" | "brazil"): { address: string; onCurve: boolean } {
  const who = new PublicKey(owner);
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("senda"), new TextEncoder().encode(actor), who.toBytes()],
    MEMO_PROGRAM,
  );
  return { address: pda.toBase58(), onCurve: PublicKey.isOnCurve(pda.toBytes()) };
}

export function feeTape(rows: Array<{ prioritizationFee?: number }>): { p50: number; p90: number; hold: boolean; line: string } {
  const nums = rows.map((row) => Number(row.prioritizationFee) || 0).filter((n) => n > 0).sort((a, b) => a - b);
  const at = (p: number) => (nums.length ? nums[Math.min(nums.length - 1, Math.floor(p * (nums.length - 1)))] : 0);
  const p50 = at(0.5);
  const p90 = at(0.9);
  const hold = p90 >= 50_000;
  return {
    p50,
    p90,
    hold,
    line: hold
      ? "The local fee market is hot. Hold a USDC send. A memo still fits."
      : nums.length
        ? "The local fee market is quiet."
        : "No priority fee in the recent sample.",
  };
}

export function memoInstruction(owner: PublicKey, line: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM,
    keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
    data: Buffer.from(line, "utf8"),
  });
}

export function buildAnchorTx(args: { owner: PublicKey; blockhash: string; message: Uint8Array; signature: Uint8Array }): Transaction {
  const tx = new Transaction();
  tx.feePayer = args.owner;
  tx.recentBlockhash = args.blockhash;
  tx.add(
    Ed25519Program.createInstructionWithPublicKey({
      publicKey: args.owner.toBytes(),
      message: args.message,
      signature: args.signature,
    }),
  );
  tx.add(memoInstruction(args.owner, new TextDecoder().decode(args.message)));
  return tx;
}

export function buildDurableMemo(args: { owner: PublicKey; nonceAccount: PublicKey; nonce: string; line: string }): Transaction {
  const tx = new Transaction();
  tx.feePayer = args.owner;
  tx.recentBlockhash = args.nonce;
  tx.add(SystemProgram.nonceAdvance({ noncePubkey: args.nonceAccount, authorizedPubkey: args.owner }));
  tx.add(memoInstruction(args.owner, args.line));
  return tx;
}

export function buildNonceOpen(args: { owner: PublicKey; nonce: PublicKey; lamports: number; blockhash: string }): Transaction {
  const tx = SystemProgram.createNonceAccount({
    fromPubkey: args.owner,
    noncePubkey: args.nonce,
    authorizedPubkey: args.owner,
    lamports: args.lamports,
  });
  tx.feePayer = args.owner;
  tx.recentBlockhash = args.blockhash;
  return tx;
}

export function freshNonce(): Keypair {
  return Keypair.generate();
}

export function readNonce(data: Uint8Array): { authority: string; nonce: string } {
  const account = NonceAccount.fromAccountData(data);
  return { authority: account.authorizedPubkey.toBase58(), nonce: account.nonce };
}

export function lookupCount(data: Uint8Array): number {
  return AddressLookupTableAccount.deserialize(data).addresses.length;
}

export type MintPolicy = { program: "Token" | "Token-2022" | "Other"; lines: string[] };

export function readMintPolicy(address: string, data: Uint8Array, owner: string): MintPolicy {
  const pubkey = new PublicKey(address);
  const ownerKey = new PublicKey(owner);
  const info = { data: Buffer.from(data), executable: false, lamports: 0, owner: ownerKey };
  if (ownerKey.equals(TOKEN_PROGRAM_ID)) {
    const mint = unpackMint(pubkey, info, TOKEN_PROGRAM_ID);
    return {
      program: "Token",
      lines: [`${mint.decimals} decimals. Supply is ${mint.supply.toString()} base units.`, "No extensions. This mint is only a balance."],
    };
  }
  if (!ownerKey.equals(TOKEN_2022_PROGRAM_ID)) return { program: "Other", lines: ["This account is not a token mint."] };
  const mint = unpackMint(pubkey, info, TOKEN_2022_PROGRAM_ID);
  const lines = [`${mint.decimals} decimals. Supply is ${mint.supply.toString()} base units.`, "Token-2022. The mint is a policy, not only a balance."];
  const hook = getTransferHook(mint);
  if (hook && !hook.programId.equals(SystemProgram.programId)) lines.push(`A transfer must call ${hook.programId.toBase58()}. The mint decides who else runs.`);
  else if (hook) lines.push("A transfer-hook field is present, and no program is set.");
  const delegate = getPermanentDelegate(mint);
  if (delegate && !delegate.delegate.equals(SystemProgram.programId)) lines.push(`Permanent delegate ${delegate.delegate.toBase58()} can move tokens without the holder.`);
  const fee = getTransferFeeConfig(mint);
  if (fee) {
    const newer = fee.newerTransferFee;
    lines.push(newer.transferFeeBasisPoints > 0
      ? `Transfer fee ${newer.transferFeeBasisPoints} bps, cap ${newer.maximumFee.toString()} base units.`
      : "A transfer-fee extension is present. The current fee is 0.");
  }
  const interest = getInterestBearingMintConfigState(mint);
  if (interest) lines.push(`Interest-bearing at ${interest.currentRate} basis points. The displayed amount is not the raw balance.`);
  if (getNonTransferable(mint)) lines.push("Non-transferable. This mint is an identity, not a coin you can send.");
  const pause = getPausableConfig(mint);
  if (pause) lines.push(pause.paused ? `Paused by ${pause.authority.toBase58()}. Transfers are stopped.` : `Can be paused by ${pause.authority.toBase58()}.`);
  const close = getMintCloseAuthority(mint);
  if (close) lines.push(`Close authority ${close.closeAuthority.toBase58()}.`);
  const burn = getPermissionedBurn(mint);
  if (burn?.authority) lines.push(`Burn is limited to ${burn.authority.toBase58()}.`);
  const meta = getMetadataPointerState(mint);
  if (meta?.metadataAddress) lines.push(`Metadata pointer ${meta.metadataAddress.toBase58()}.`);
  const start = getDefaultAccountState(mint);
  if (start) lines.push(start.state === 2 ? "New accounts start frozen." : "New accounts have a default state.");
  const named = new Set<number>([
    ExtensionType.TransferHook,
    ExtensionType.PermanentDelegate,
    ExtensionType.TransferFeeConfig,
    ExtensionType.InterestBearingConfig,
    ExtensionType.NonTransferable,
    ExtensionType.PausableConfig,
    ExtensionType.MintCloseAuthority,
    ExtensionType.PermissionedBurn,
    ExtensionType.MetadataPointer,
    ExtensionType.DefaultAccountState,
  ]);
  const extra: Record<number, string> = { 16: "Confidential transfer fee", 17: "Confidential transfer fee amount", 24: "Confidential mint burn" };
  for (const kind of getExtensionTypes(mint.tlvData)) {
    if (named.has(kind)) continue;
    if (kind === ExtensionType.ConfidentialTransferMint) {
      lines.push("Confidential transfer is on. Amounts can be hidden. This desk does not decrypt them.");
      continue;
    }
    const label = extra[kind] || ExtensionType[kind] || `extension ${kind}`;
    lines.push(`${label} is on this mint.`);
  }
  if (lines.length === 2) lines.push("No extra policy was set on this mint.");
  return { program: "Token-2022", lines };
}
