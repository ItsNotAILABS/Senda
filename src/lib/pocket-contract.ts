import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { broadcastSigned, phantomProvider, splHolding } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const BOOK = "senda.pocket.book.v1";
const KEYS = "senda.pocket.keys.v1";

export type PocketKind = "time" | "constraint" | "decision" | "send";

export type MoneyPocket = {
  id: string;
  sig: string;
  kind: PocketKind;
  usd: number;
  owner: string;
  pocket: string;
  to: string;
  until?: number;
  symbol?: string;
  side?: "above" | "below";
  strike?: number;
  title?: string;
  status: "held" | "released" | "returned";
  openedAt: number;
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
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), USDC_MINT.toBuffer()], ATA_PROGRAM)[0];
}

function u64(amount: bigint): Uint8Array {
  const d = new Uint8Array(9);
  d[0] = 3;
  new DataView(d.buffer).setBigUint64(1, amount, true);
  return d;
}

function keys(): Record<string, number[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEYS) || "{}") as Record<string, number[]>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveKey(pub: string, secret: number[]) {
  const next = keys();
  next[pub] = secret;
  window.localStorage.setItem(KEYS, JSON.stringify(next));
}

function dropKey(pub: string) {
  const next = keys();
  delete next[pub];
  window.localStorage.setItem(KEYS, JSON.stringify(next));
}

function pocketKey(pub: string): Keypair {
  const secret = keys()[pub];
  if (!secret) throw new Error("This browser does not hold that pocket.");
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function listPockets(): MoneyPocket[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(BOOK) || "[]") as MoneyPocket[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: MoneyPocket[]) {
  window.localStorage.setItem(BOOK, JSON.stringify(rows));
}

export function pocketOpen(row: MoneyPocket, last = 0): boolean {
  if (row.status !== "held") return false;
  if (row.kind === "time") return Date.now() >= (row.until || 0);
  if (row.kind === "constraint") {
    if (!(last > 0) || !(row.strike && row.strike > 0)) return false;
    return row.side === "below" ? last <= row.strike : last >= row.strike;
  }
  return true;
}

export async function createPocket(input: {
  owner: string;
  usd: number;
  kind: PocketKind;
  to: string;
  until?: number;
  symbol?: string;
  side?: "above" | "below";
  strike?: number;
  title?: string;
}): Promise<MoneyPocket> {
  const usd = Math.round(input.usd * 100) / 100;
  if (!(usd >= 0.01)) throw new Error("A pocket needs at least $0.01.");
  const kp = Keypair.generate();
  const pub = kp.publicKey.toBase58();
  saveKey(pub, Array.from(kp.secretKey));
  const to = input.to.trim();
  if (to) {
    try {
      new PublicKey(to);
    } catch {
      dropKey(pub);
      throw new Error("That release address is not a Solana address.");
    }
  }
  if (input.kind === "send" && !to) {
    dropKey(pub);
    throw new Error("A send contract needs the address it pays.");
  }
  const memo = `Senda ${input.kind} ${input.title || ""} ${usd}`.trim().slice(0, 80);
  try {
    const paid = await payUsdc({ owner: input.owner, to: pub, usd, memo });
    const row: MoneyPocket = {
      id: pub,
      sig: paid.signature,
      kind: input.kind,
      usd,
      owner: input.owner,
      pocket: pub,
      to: to || input.owner,
      until: input.until,
      symbol: input.symbol,
      side: input.side,
      strike: input.strike,
      title: input.title?.trim() || input.kind,
      status: "held",
      openedAt: Date.now(),
    };
    save([row, ...listPockets()]);
    return row;
  } catch (e) {
    dropKey(pub);
    throw e;
  }
}

async function sendOut(pub: string, toAddress: string, usd: number, feePayer: string): Promise<string> {
  const vault = pocketKey(pub);
  const owner = new PublicKey(feePayer);
  const to = new PublicKey(toAddress);
  const source = ata(vault.publicKey);
  const dest = ata(to);
  const held = await splHolding(pub, USDC_MINT.toBase58());
  const raw = BigInt(Math.min(Math.round(usd * 1_000_000), Number(held.raw) || 0));
  if (raw <= 0n) throw new Error("That pocket has no USDC.");
  const exists = (await rpc("getAccountInfo", [dest.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  const hash = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  const ix: TransactionInstruction[] = [];
  if (!exists?.value) {
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
        { pubkey: vault.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(u64(raw)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = hash.value.blockhash;
  tx.add(...ix);
  tx.partialSign(vault);
  const provider = phantomProvider();
  if (!provider?.signTransaction) throw new Error("Phantom has to pay the fee. Connect it in this window.");
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}

export async function releasePocket(row: MoneyPocket, feePayer: string, last = 0): Promise<string> {
  if (row.status !== "held") throw new Error("That pocket is already empty.");
  if (!pocketOpen(row, last)) throw new Error("That pocket is not open yet.");
  const sig = await sendOut(row.pocket, row.to || feePayer, row.usd, feePayer);
  save(listPockets().map((p) => (p.id === row.id ? { ...p, status: "released" as const, sig } : p)));
  return sig;
}

export async function returnPocket(row: MoneyPocket, feePayer: string): Promise<string> {
  if (row.status !== "held") throw new Error("That pocket is already empty.");
  const sig = await sendOut(row.pocket, feePayer, row.usd, feePayer);
  save(listPockets().map((p) => (p.id === row.id ? { ...p, status: "returned" as const, sig } : p)));
  return sig;
}

export async function movePocket(row: MoneyPocket, into: MoneyPocket, feePayer: string): Promise<string> {
  if (row.status !== "held" || into.status !== "held") throw new Error("Both pockets have to be holding cash.");
  if (row.id === into.id) throw new Error("Pick a different pocket.");
  const sig = await sendOut(row.pocket, into.pocket, row.usd, feePayer);
  save(
    listPockets().map((p) => {
      if (p.id === row.id) return { ...p, status: "released" as const, sig };
      if (p.id === into.id) return { ...p, usd: Math.round((p.usd + row.usd) * 100) / 100 };
      return p;
    }),
  );
  return sig;
}

const POSITIONS = "senda.position.book.v1";

export type SharePosition = {
  id: string;
  title: string;
  symbol: string;
  mint: string;
  ui: number;
  decimals: number;
  pocket: string;
  owner: string;
  sig: string;
  status: "held" | "sent" | "returned";
  openedAt: number;
};

function ataOf(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}

export function listPositions(): SharePosition[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(POSITIONS) || "[]") as SharePosition[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function savePositions(rows: SharePosition[]) {
  window.localStorage.setItem(POSITIONS, JSON.stringify(rows));
}

async function moveSpl(input: {
  mint: PublicKey;
  fromOwner: PublicKey;
  toOwner: PublicKey;
  amount: bigint;
  feePayer: string;
  vault?: Keypair;
}): Promise<string> {
  if (input.amount <= 0n) throw new Error("Nothing to move.");
  const fee = new PublicKey(input.feePayer);
  const source = ataOf(input.fromOwner, input.mint);
  const dest = ataOf(input.toOwner, input.mint);
  const authority = input.vault?.publicKey ?? input.fromOwner;
  const exists = (await rpc("getAccountInfo", [dest.toBase58(), { encoding: "base64" }])) as { value?: unknown };
  const hash = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  const ix: TransactionInstruction[] = [];
  if (!exists?.value) {
    ix.push(
      new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: fee, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: input.toOwner, isSigner: false, isWritable: false },
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
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(u64(input.amount)),
    }),
  );
  const tx = new Transaction();
  tx.feePayer = fee;
  tx.recentBlockhash = hash.value.blockhash;
  tx.add(...ix);
  if (input.vault) tx.partialSign(input.vault);
  const provider = phantomProvider();
  if (!provider?.signTransaction) throw new Error("Phantom has to sign. Connect it in this window.");
  const signed = await provider.signTransaction(tx);
  return broadcastSigned(signed);
}

export async function parkShares(input: { owner: string; mint: string; symbol: string; title: string }): Promise<SharePosition> {
  const held = await splHolding(input.owner, input.mint);
  if (!held || BigInt(held.raw) <= 0n) throw new Error("Buy the shares first. This Phantom holds none.");
  const kp = Keypair.generate();
  const pub = kp.publicKey.toBase58();
  saveKey(pub, Array.from(kp.secretKey));
  try {
    const sig = await moveSpl({
      mint: new PublicKey(input.mint),
      fromOwner: new PublicKey(input.owner),
      toOwner: kp.publicKey,
      amount: BigInt(held.raw),
      feePayer: input.owner,
    });
    const row: SharePosition = {
      id: pub,
      title: input.title.trim() || input.symbol,
      symbol: input.symbol,
      mint: input.mint,
      ui: held.ui,
      decimals: held.decimals,
      pocket: pub,
      owner: input.owner,
      sig,
      status: "held",
      openedAt: Date.now(),
    };
    savePositions([row, ...listPositions()]);
    return row;
  } catch (e) {
    dropKey(pub);
    throw e;
  }
}

export async function sendShares(row: SharePosition, to: string, feePayer: string): Promise<string> {
  if (row.status !== "held") throw new Error("That position is already out of the contract.");
  let dest: PublicKey;
  try {
    dest = new PublicKey(to);
  } catch {
    throw new Error("That is not a Solana address.");
  }
  const vault = pocketKey(row.pocket);
  const held = await splHolding(row.pocket, row.mint);
  const sig = await moveSpl({
    mint: new PublicKey(row.mint),
    fromOwner: vault.publicKey,
    toOwner: dest,
    amount: BigInt(held.raw || "0"),
    feePayer,
    vault,
  });
  savePositions(listPositions().map((p) => (p.id === row.id ? { ...p, status: "sent" as const, sig } : p)));
  return sig;
}

export async function returnShares(row: SharePosition, feePayer: string): Promise<string> {
  if (row.status !== "held") throw new Error("That position is already out of the contract.");
  const vault = pocketKey(row.pocket);
  const held = await splHolding(row.pocket, row.mint);
  const sig = await moveSpl({
    mint: new PublicKey(row.mint),
    fromOwner: vault.publicKey,
    toOwner: new PublicKey(feePayer),
    amount: BigInt(held.raw || "0"),
    feePayer,
    vault,
  });
  savePositions(listPositions().map((p) => (p.id === row.id ? { ...p, status: "returned" as const, sig } : p)));
  return sig;
}
