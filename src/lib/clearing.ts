/** PreStock clearing. Margin is USDC in one account. The print is a Jupiter quote. A payout cannot exceed that account. */

import { createServerFn } from "@tanstack/react-start";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { z } from "zod";
import { transferData } from "@/lib/chain-codec";
import { fetchQuote } from "@/lib/jup-exec";
import { fetchHouse } from "@/lib/sol-house";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const DIR = "/workspace/data";
const KEY_FILE = `${DIR}/clearing-key.json`;
const BOOK_FILE = `${DIR}/clearing-book.json`;

const TENOR_MS = { "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 } as const;
type Tenor = keyof typeof TENOR_MS;

type Match = { notional: number; price: number; myMargin: number; otherMargin: number; otherId: string };
type Perp = {
  id: string;
  owner: string;
  symbol: string;
  mint: string;
  side: "long" | "short";
  notional: number;
  margin: number;
  openSig: string;
  entry: number;
  /** 0 is a market order at the print. A long rests until the print is at or under this. A short rests until the print is at or over it. */
  limit: number;
  /** fdv marks the implied valuation. last marks the token print. Old rows are last. */
  index?: "fdv" | "last";
  openedAt: number;
  status: "open" | "closed";
  matches: Match[];
};
type Leg = { owner: string; usd: number; sig: string };
type Pred = {
  id: string;
  symbol: string;
  mint: string;
  tenor: Tenor;
  windowEnd: number;
  openPrice: number;
  /** 0 means up or down from the locked print. Anything else is "above this price". */
  strike: number;
  /** line is the strike. band is inside two prices. swing is a percent move either way. */
  style: "line" | "band" | "swing";
  /** Band high, or the percent a swing has to move. 0 on a line. */
  hi: number;
  yes: Leg[];
  no: Leg[];
  status: "open" | "settled";
};
type Race = {
  id: string;
  left: string;
  leftMint: string;
  leftOpen: number;
  right: string;
  rightMint: string;
  rightOpen: number;
  tenor: Tenor;
  windowEnd: number;
  leftLegs: Leg[];
  rightLegs: Leg[];
  status: "open" | "settled";
};
type Flight = {
  kind: "perp" | "pred" | "race";
  id: string;
  usd: number;
  at: number;
  tx: string;
  cuts?: Array<{ otherId: string; notional: number; margin: number }>;
};
type Purse = { id: string; owner: string; name: string; usd: number };
type Book = { perps: Perp[]; preds: Pred[]; races: Race[]; sigs: string[]; flight: Flight | null; fees: number; purses: Purse[] };

const FEE_BPS = 100;

function usd6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** One percent stays in the house. The rest is the wager. */
function splitFee(usd: number): { wager: number; fee: number } {
  const fee = usd6(usd * FEE_BPS / 10_000);
  return { wager: usd6(usd - fee), fee };
}

let chain: Promise<unknown> = Promise.resolve();
function lock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function house(): Keypair {
  mkdirSync(DIR, { recursive: true });
  if (existsSync(KEY_FILE)) {
    const secret = JSON.parse(readFileSync(KEY_FILE, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  writeFileSync(KEY_FILE, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

function readBook(): Book {
  try {
    const raw = JSON.parse(readFileSync(BOOK_FILE, "utf8")) as Book;
    return {
      perps: Array.isArray(raw.perps) ? raw.perps : [],
      preds: Array.isArray(raw.preds) ? raw.preds : [],
      races: Array.isArray(raw.races) ? raw.races : [],
      sigs: Array.isArray(raw.sigs) ? raw.sigs : [],
      flight: raw.flight || null,
      fees: Number(raw.fees) || 0,
      purses: Array.isArray(raw.purses) ? raw.purses : [],
    };
  } catch {
    return { perps: [], preds: [], races: [], sigs: [], flight: null, fees: 0, purses: [] };
  }
}

function writeBook(book: Book) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(BOOK_FILE, JSON.stringify(book));
}

function ata(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN.toBuffer(), new PublicKey(USDC).toBuffer()],
    ATA_PROGRAM,
  )[0];
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const urls = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
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
}

async function usdcOf(owner: string): Promise<number> {
  const result = (await rpc("getTokenAccountsByOwner", [owner, { mint: USDC }, { encoding: "jsonParsed" }])) as {
    value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } } } } }>;
  };
  return (result?.value || []).reduce((s, row) => s + (row.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0);
}

const OSTIUM_PRINT: Record<string, string> = {
  XAU: "XAU-USD",
  XAG: "XAG-USD",
  XPT: "XPT-USD",
  XPD: "XPD-USD",
  XCU: "XCU-USD",
  WTI: "WTI-USD",
  BRENT: "BRENT-USD",
  US500: "US500-USD",
  US100: "US100-USD",
  US30: "US30-USD",
  COCOA: "COCOA-USD",
  COFFEE: "COFFEE-USD",
  SUGAR: "SUGAR-USD",
};

async function ostiumPrint(pair: string): Promise<number> {
  const res = await fetch("https://builder.prod.bedrock.ostium.io/v1/prices", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("The commodity print did not load.");
  const body = (await res.json()) as { prices?: { pair?: string; mid?: number }[] };
  const row = (body.prices ?? []).find((p) => p.pair === pair);
  if (!(row?.mid && row.mid > 0)) throw new Error(`No print for ${pair}.`);
  return row.mid;
}

async function fdvOf(mint: string): Promise<number> {
  const house = await fetchHouse();
  const row = house.find((h) => h.mint === mint);
  const fdv = row?.valuation || 0;
  if (!(fdv > 0)) throw new Error("No implied FDV for that name.");
  return fdv;
}

async function indexOf(pos: { mint: string; symbol: string; index?: string }): Promise<number> {
  if (pos.index === "fdv") return fdvOf(pos.mint);
  return markOf(pos.mint, pos.symbol);
}

async function markOf(mint: string, symbol?: string): Promise<number> {
  const pair = symbol ? OSTIUM_PRINT[symbol] : undefined;
  if (pair) return ostiumPrint(pair);
  const q = await fetchQuote(mint, 10, "buy");
  if ("error" in q) throw new Error(q.error);
  const info = (await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }])) as {
    value?: { data?: { parsed?: { info?: { decimals?: number } } } };
  };
  const dec = info?.value?.data?.parsed?.info?.decimals ?? 9;
  const tokens = Number(q.outAmount) / 10 ** dec;
  if (!(tokens > 0)) throw new Error("Jupiter has no print for that mint.");
  return Math.round((10 / tokens) * 1e6) / 1e6;
}

type ChainTx = {
  meta?: {
    err?: unknown;
    logMessages?: string[];
    preTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { uiAmount?: number | null } }>;
    postTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { uiAmount?: number | null } }>;
  };
  transaction?: { message?: { accountKeys?: Array<{ pubkey?: string; signer?: boolean } | string>; instructions?: Array<{ parsed?: unknown }> } };
};

async function readTx(sig: string): Promise<ChainTx | null> {
  for (let i = 0; i < 6; i += 1) {
    for (const commitment of ["confirmed", "processed"] as const) {
      try {
        const tx = (await rpc("getTransaction", [sig, { encoding: "jsonParsed", commitment, maxSupportedTransactionVersion: 0 }])) as ChainTx | null;
        if (tx) return tx;
      } catch {
        /* the other commitment, then wait */
      }
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

async function depositOf(sig: string, owner: string, clearing: string, memoHas: string): Promise<number> {
  const tx = await readTx(sig);
  if (!tx) throw new Error("That signature is not on the chain yet.");
  if (tx.meta?.err) throw new Error("That transaction failed.");
  const keys = tx.transaction?.message?.accountKeys || [];
  const signed = keys.some((k) => (typeof k === "string" ? k === owner : k.pubkey === owner && k.signer));
  if (!signed) throw new Error("That transaction was not signed by this wallet.");
  const blob = JSON.stringify(tx.meta?.logMessages || []) + JSON.stringify(tx.transaction?.message?.instructions || []);
  if (!blob.includes(memoHas)) throw new Error("That transfer is not this order.");
  const sum = (rows?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { uiAmount?: number | null } }>) =>
    (rows || []).filter((r) => r.mint === USDC && r.owner === clearing).reduce((s, r) => s + (r.uiTokenAmount?.uiAmount || 0), 0);
  const got = Math.round((sum(tx.meta?.postTokenBalances) - sum(tx.meta?.preTokenBalances)) * 1_000_000) / 1_000_000;
  if (!(got > 0)) throw new Error("No USDC landed in the clearing account.");
  return got;
}

function liability(book: Book): number {
  let n = 0;
  for (const p of book.perps) if (p.status === "open") n += p.margin;
  for (const c of book.preds) {
    if (c.status !== "open") continue;
    for (const leg of [...c.yes, ...c.no]) n += leg.usd;
  }
  for (const race of book.races) {
    if (race.status !== "open") continue;
    for (const leg of [...race.leftLegs, ...race.rightLegs]) n += leg.usd;
  }
  if (book.flight) n += book.flight.usd;
  for (const purse of book.purses || []) n += purse.usd;
  return Math.round(n * 1_000_000) / 1_000_000;
}

async function expireFlight(book: Book, clearing: string): Promise<Book> {
  if (!book.flight || Date.now() - book.flight.at < 90_000) return book;
  const on = await usdcOf(clearing);
  const still = on + 0.02 >= liability(book);
  if (still) return { ...book, flight: null };
  if (book.flight.kind === "perp") return applyPerpClose({ ...book, flight: null }, book.flight);
  if (book.flight.kind === "race") {
    return { ...book, flight: null, races: book.races.map((r) => (r.id === book.flight?.id ? { ...r, status: "settled" } : r)) };
  }
  return { ...book, flight: null, preds: book.preds.map((c) => (c.id === book.flight?.id ? { ...c, status: "settled" } : c)) };
}

function applyPerpClose(book: Book, flight: Flight): Book {
  return {
    ...book,
    perps: book.perps.map((p) => {
      if (p.id === flight.id) return { ...p, status: "closed" };
      const cut = flight.cuts?.find((c) => c.otherId === p.id);
      if (!cut || p.status !== "open") return p;
      const margin = Math.round((p.margin - cut.margin) * 100) / 100;
      const notional = Math.round((p.notional - cut.notional) * 100) / 100;
      const matches = p.matches.filter((m) => m.otherId !== flight.id);
      const status = notional < 0.05 || margin <= 0 ? "closed" : p.status;
      return { ...p, margin: Math.max(0, margin), notional: Math.max(0, notional), matches, status };
    }),
  };
}

function pair(book: Book, pos: Perp, price: number) {
  if (!accepts(pos, price)) return;
  let left = pos.notional;
  for (const other of book.perps) {
    if (other.status !== "open" || other.mint !== pos.mint || other.side === pos.side) continue;
    if (!accepts(other, price)) continue;
    const taken = other.matches.reduce((s, m) => s + m.notional, 0);
    const free = other.notional - taken;
    const take = Math.min(left, free);
    if (take < 0.05) continue;
    const myMargin = (pos.margin * take) / pos.notional;
    const otherMargin = (other.margin * take) / other.notional;
    pos.matches.push({ notional: take, price, myMargin, otherMargin, otherId: other.id });
    other.matches.push({ notional: take, price, myMargin: otherMargin, otherMargin: myMargin, otherId: pos.id });
    left -= take;
    if (left < 0.05) break;
  }
}

function accepts(pos: Perp, mark: number): boolean {
  if (!(pos.limit > 0)) return true;
  if (pos.side === "long") return mark <= pos.limit;
  return mark >= pos.limit;
}

/** Positive means this position pays the other side. 1 bp of matched size per hour, scaled by how crowded its side is. */
function fundingOf(pos: Perp, book: Book): number {
  if (!pos.openedAt || pos.matches.length === 0) return 0;
  const hours = (Date.now() - pos.openedAt) / 3_600_000;
  if (hours < 1 / 60) return 0;
  const open = book.perps.filter((p) => p.status === "open" && p.mint === pos.mint);
  const longs = open.filter((p) => p.side === "long").reduce((s, p) => s + p.notional, 0);
  const shorts = open.filter((p) => p.side === "short").reduce((s, p) => s + p.notional, 0);
  if (longs + shorts <= 0) return 0;
  const tilt = (longs - shorts) / (longs + shorts);
  const matched = pos.matches.reduce((s, m) => s + m.notional, 0);
  const signed = (pos.side === "long" ? tilt : -tilt) * 0.0001 * hours * matched;
  return Math.round(signed * 100) / 100;
}

function perpPayout(pos: Perp, mark: number): { usd: number; closeOther: string[] } {
  let usd = 0;
  const closeOther: string[] = [];
  const matched = pos.matches.reduce((s, m) => s + m.notional, 0);
  const matchedMargin = pos.matches.reduce((s, m) => s + m.myMargin, 0);
  usd += Math.max(0, pos.margin - matchedMargin);
  for (const m of pos.matches) {
    const dir = pos.side === "long" ? 1 : -1;
    const pnl = m.price > 0 ? ((mark - m.price) / m.price) * m.notional * dir : 0;
    const pay = Math.max(-m.myMargin, Math.min(m.otherMargin, pnl));
    usd += m.myMargin + pay;
    closeOther.push(m.otherId);
  }
  if (matched <= 0) usd = pos.margin;
  return { usd: Math.round(usd * 100) / 100, closeOther };
}

async function blockhash(): Promise<string> {
  const result = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  const hash = result?.value?.blockhash;
  if (!hash) throw new Error("No blockhash.");
  return hash;
}

async function payoutTx(feePayer: string, clearing: Keypair, sends: Array<{ to: string; usd: number }>): Promise<string> {
  const payer = new PublicKey(feePayer);
  const ix: TransactionInstruction[] = [];
  for (const send of sends) {
    if (!(send.usd > 0)) continue;
    const destOwner = new PublicKey(send.to);
    const dest = ata(destOwner);
    const info = (await rpc("getAccountInfo", [dest.toBase58(), { encoding: "base64" }])) as { value?: unknown };
    if (!info?.value) {
      ix.push(
        new TransactionInstruction({
          programId: ATA_PROGRAM,
          keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: dest, isSigner: false, isWritable: true },
            { pubkey: destOwner, isSigner: false, isWritable: false },
            { pubkey: new PublicKey(USDC), isSigner: false, isWritable: false },
            { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
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
          { pubkey: ata(clearing.publicKey), isSigner: false, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: clearing.publicKey, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(transferData(BigInt(Math.round(send.usd * 1_000_000)))),
      }),
    );
  }
  if (!ix.length) throw new Error("Nothing to pay.");
  const on = await usdcOf(clearing.publicKey.toBase58());
  const need = sends.reduce((s, x) => s + x.usd, 0);
  if (on + 0.02 < need) throw new Error(`The clearing account holds $${on.toFixed(2)}. This pays $${need.toFixed(2)}.`);
  const tx = new Transaction();
  tx.feePayer = payer;
  tx.recentBlockhash = await blockhash();
  tx.add(...ix);
  tx.partialSign(clearing);
  return Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString("base64");
}

function pubView(book: Book, clearing: string, usdc: number) {
  return {
    pubkey: clearing,
    usdc: Math.round(usdc * 100) / 100,
    perps: book.perps.filter((p) => p.status === "open"),
    preds: book.preds.filter((c) => c.status === "open"),
    races: book.races.filter((r) => r.status === "open"),
    fees: usd6(book.fees || 0),
    purses: book.purses || [],
  };
}

export const loadClearing = createServerFn({ method: "GET" }).handler(async () => {
  return lock(async () => {
    const kp = house();
    const id = kp.publicKey.toBase58();
    let book = await expireFlight(readBook(), id);
    writeBook(book);
    return pubView(book, id, await usdcOf(id));
  });
});

export const postPerp = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      owner: z.string().min(32).max(48),
      sig: z.string().min(32),
      symbol: z.string().min(1).max(24),
      mint: z.string().min(32).max(48),
      side: z.enum(["long", "short"]),
      notional: z.number().min(1).max(5000),
      margin: z.number().min(1).max(5000),
      limit: z.number().min(0).max(1e15).optional(),
      index: z.enum(["fdv", "last"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.notional > data.margin * 4 + 0.01) throw new Error("Leverage stops at 4×. Post more margin or cut the size.");
    if (data.notional + 0.01 < data.margin) throw new Error("The size is smaller than the margin.");
    return lock(async () => {
      const kp = house();
      const clearing = kp.publicKey.toBase58();
      const book = await expireFlight(readBook(), clearing);
      if (book.sigs.includes(data.sig)) throw new Error("That deposit is already a position.");
      const memo = `Senda clear perp ${data.symbol} ${data.side}`;
      const got = await depositOf(data.sig, data.owner, clearing, memo);
      if (got + 0.02 < data.margin) throw new Error(`The transfer was $${got.toFixed(2)}. The margin is $${data.margin.toFixed(2)}.`);
      const price = data.index === "fdv" ? await fdvOf(data.mint) : await markOf(data.mint);
      const pos: Perp = {
        id: data.sig.slice(0, 12),
        owner: data.owner,
        symbol: data.symbol,
        mint: data.mint,
        side: data.side,
        notional: data.notional,
        margin: data.margin,
        openSig: data.sig,
        entry: price,
        limit: data.limit && data.limit > 0 ? data.limit : 0,
        index: data.index === "fdv" ? "fdv" : "last",
        openedAt: Date.now(),
        status: "open",
        matches: [],
      };
      book.perps.unshift(pos);
      book.sigs.push(data.sig);
      pair(book, pos, price);
      writeBook(book);
      return { id: pos.id, price, matched: pos.matches.reduce((s, m) => s + m.notional, 0) };
    });
  });

export const closePerp = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ owner: z.string().min(32), id: z.string().min(4) }).parse(input))
  .handler(async ({ data }) => {
    return lock(async () => {
      const kp = house();
      const clearing = kp.publicKey.toBase58();
      const book = await expireFlight(readBook(), clearing);
      if (book.flight) {
        if (book.flight.kind === "perp" && book.flight.id === data.id) return { tx: book.flight.tx, usd: book.flight.usd };
        throw new Error("Another payout is waiting for a signature.");
      }
      const pos = book.perps.find((p) => p.id === data.id && p.status === "open");
      if (!pos || pos.owner !== data.owner) throw new Error("That position is not open on this wallet.");
      const mark = await indexOf(pos);
      const { usd } = perpPayout(pos, mark);
      const sends: Array<{ to: string; usd: number }> = [{ to: pos.owner, usd }];
      const cuts: Array<{ otherId: string; notional: number; margin: number }> = [];
      for (const slice of pos.matches) {
        const other = book.perps.find((p) => p.id === slice.otherId && p.status === "open");
        if (!other) continue;
        const dir = pos.side === "long" ? 1 : -1;
        const pnl = slice.price > 0 ? ((mark - slice.price) / slice.price) * slice.notional * dir : 0;
        const pay = Math.max(-slice.myMargin, Math.min(slice.otherMargin, pnl));
        const back = Math.round((slice.otherMargin - pay) * 100) / 100;
        const row = sends.find((s) => s.to === other.owner);
        if (row) row.usd = Math.round((row.usd + back) * 100) / 100;
        else if (back > 0) sends.push({ to: other.owner, usd: back });
        cuts.push({ otherId: other.id, notional: slice.notional, margin: slice.otherMargin });
      }
      const fund = fundingOf(pos, book);
      if (fund !== 0 && pos.matches[0]) {
        const other = book.perps.find((p) => p.id === pos.matches[0].otherId && p.status === "open");
        const me = sends.find((s) => s.to === pos.owner);
        const them = other ? sends.find((s) => s.to === other.owner) : undefined;
        if (me && them) {
          const shift = Math.max(-them.usd, Math.min(me.usd, fund));
          me.usd = Math.round((me.usd - shift) * 100) / 100;
          them.usd = Math.round((them.usd + shift) * 100) / 100;
        }
      }
      const tx = await payoutTx(data.owner, kp, sends);
      const total = Math.round(sends.reduce((s, x) => s + x.usd, 0) * 100) / 100;
      book.flight = { kind: "perp", id: pos.id, usd: total, at: Date.now(), tx, cuts };
      writeBook(book);
      return { tx, usd, mark };
    });
  });

export const confirmFlight = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ sig: z.string().min(32) }).parse(input))
  .handler(async ({ data }) => {
    return lock(async () => {
      const kp = house();
      const book = readBook();
      const flight = book.flight;
      if (!flight) return { ok: true };
      const tx = await readTx(data.sig);
      if (!tx) throw new Error("That payout is not on the chain yet.");
      if (tx.meta?.err) throw new Error("The payout failed.");
      if (flight.kind === "perp") {
        const next = applyPerpClose(book, flight);
        book.perps = next.perps;
      } else if (flight.kind === "race") {
        book.races = book.races.map((r) => (r.id === flight.id ? { ...r, status: "settled" } : r));
      } else book.preds = book.preds.map((c) => (c.id === flight.id ? { ...c, status: "settled" } : c));
      book.flight = null;
      book.sigs.push(data.sig);
      writeBook(book);
      return { ok: true };
    });
  });

export const postPred = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      owner: z.string().min(32).max(48),
      sig: z.string().min(32),
      symbol: z.string().min(1).max(24),
      mint: z.string().min(32).max(48),
      tenor: z.enum(["15m", "1h", "4h", "1d"]),
      side: z.enum(["yes", "no"]),
      usd: z.number().min(0.001).max(1_000_000),
      strike: z.number().min(0).max(1_000_000).optional(),
      style: z.enum(["line", "band", "swing"]).optional(),
      hi: z.number().min(0).max(1_000_000).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    return lock(async () => {
      const kp = house();
      const clearing = kp.publicKey.toBase58();
      const book = await expireFlight(readBook(), clearing);
      if (book.sigs.includes(data.sig)) throw new Error("That deposit is already a contract.");
      const strike = Math.round((data.strike || 0) * 100) / 100;
      const style = data.style || "line";
      const hi = Math.round((data.hi || 0) * 100) / 100;
      if (style === "band" && !(hi > strike)) throw new Error("The high has to be above the low.");
      if (style === "swing" && !(hi > 0)) throw new Error("Say how far it has to move.");
      const memo =
        style === "band"
          ? `Senda clear pred ${data.symbol} ${data.tenor} ${data.side} band ${strike}-${hi}`
          : style === "swing"
            ? `Senda clear pred ${data.symbol} ${data.tenor} ${data.side} swing ${hi}`
            : `Senda clear pred ${data.symbol} ${data.tenor} ${data.side} ${strike || "open"}`;
      const got = await depositOf(data.sig, data.owner, clearing, memo);
      const slop = data.usd < 1 ? 0.000001 : 0.02;
      if (got + slop < data.usd) throw new Error(`The transfer was $${got.toFixed(6)}.`);
      const cut = splitFee(got);
      book.fees = usd6((book.fees || 0) + cut.fee);
      const end = (() => {
        const ms = TENOR_MS[data.tenor];
        let at = Math.ceil(Date.now() / ms) * ms;
        if (at - Date.now() < 60_000) at += ms;
        return at;
      })();
      let contract = book.preds.find(
        (c) =>
          c.status === "open" &&
          c.symbol === data.symbol &&
          c.tenor === data.tenor &&
          c.windowEnd === end &&
          (c.strike || 0) === strike &&
          (c.style || "line") === style &&
          (c.hi || 0) === hi,
      );
      if (!contract) {
        contract = {
          id: `${data.symbol}-${data.tenor}-${style}-${strike || "open"}-${hi || 0}-${end}`,
          symbol: data.symbol,
          mint: data.mint,
          tenor: data.tenor,
          windowEnd: end,
          openPrice: await markOf(data.mint, data.symbol),
          strike,
          style,
          hi,
          yes: [],
          no: [],
          status: "open",
        };
        book.preds.unshift(contract);
      }
      contract[data.side].push({ owner: data.owner, usd: cut.wager, sig: data.sig });
      book.sigs.push(data.sig);
      writeBook(book);
      return { id: contract.id, openPrice: contract.openPrice, windowEnd: contract.windowEnd };
    });
  });

export const settlePred = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ owner: z.string().min(32), id: z.string().min(4) }).parse(input))
  .handler(async ({ data }) => {
    return lock(async () => {
      const kp = house();
      const clearing = kp.publicKey.toBase58();
      const book = await expireFlight(readBook(), clearing);
      if (book.flight) {
        if (book.flight.kind === "pred" && book.flight.id === data.id) return { tx: book.flight.tx, usd: book.flight.usd };
        throw new Error("Another payout is waiting for a signature.");
      }
      const contract = book.preds.find((c) => c.id === data.id && c.status === "open");
      if (!contract) throw new Error("That contract is not open.");
      if (Date.now() < contract.windowEnd) throw new Error("The clock has not finished.");
      const mark = await markOf(contract.mint, contract.symbol);
      const strike = contract.strike || 0;
      const hi = contract.hi || 0;
      const style = contract.style || "line";
      const yes = contract.yes.reduce((s, l) => s + l.usd, 0);
      const no = contract.no.reduce((s, l) => s + l.usd, 0);
      const swing = contract.openPrice > 0 ? (Math.abs(mark - contract.openPrice) / contract.openPrice) * 100 : 0;
      const up =
        style === "band" ? mark >= strike && mark <= hi : style === "swing" ? swing >= hi : strike > 0 ? mark >= strike : mark > contract.openPrice;
      const sends: Array<{ to: string; usd: number }> = [];
      const add = (to: string, usd: number) => {
        const row = sends.find((s) => s.to === to);
        if (row) row.usd = Math.round((row.usd + usd) * 100) / 100;
        else sends.push({ to, usd: Math.round(usd * 100) / 100 });
      };
      const credit = (leg: Leg, usd: number) => {
        if (leg.sig.startsWith("purse:")) {
          const purse = (book.purses || []).find((p) => p.id === leg.sig.slice(6) && p.owner === leg.owner);
          if (purse) purse.usd = usd6(purse.usd + usd);
          return;
        }
        add(leg.owner, usd);
      };
      if (yes <= 0 || no <= 0) {
        for (const leg of [...contract.yes, ...contract.no]) credit(leg, leg.usd);
      } else {
        const win = up ? contract.yes : contract.no;
        const pot = yes + no;
        const base = up ? yes : no;
        for (const leg of win) credit(leg, (leg.usd / base) * pot);
      }
      if (sends.length === 0) {
        contract.status = "settled";
        writeBook(book);
        return { tx: "", usd: 0, mark, up };
      }
      const tx = await payoutTx(data.owner, kp, sends);
      const total = Math.round(sends.reduce((s, x) => s + x.usd, 0) * 100) / 100;
      book.flight = { kind: "pred", id: contract.id, usd: total, at: Date.now(), tx };
      writeBook(book);
      return { tx, usd: total, mark, up };
    });
  });

const nameZ = z.string().regex(/^[A-Za-z0-9]{2,12}$/);

export const postRace = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      owner: z.string().min(32).max(48),
      sig: z.string().min(32),
      left: nameZ,
      leftMint: z.string().min(32).max(48),
      right: nameZ,
      rightMint: z.string().min(32).max(48),
      tenor: z.enum(["15m", "1h", "4h", "1d"]),
      side: z.enum(["left", "right"]),
      usd: z.number().min(0.001).max(1_000_000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.left === data.right) throw new Error("Pick two different names.");
    return lock(async () => {
      const kp = house();
      const clearing = kp.publicKey.toBase58();
      const book = await expireFlight(readBook(), clearing);
      if (book.sigs.includes(data.sig)) throw new Error("That deposit is already in a race.");
      const memo = `Senda clear race ${data.left} ${data.right} ${data.tenor} ${data.side}`;
      const got = await depositOf(data.sig, data.owner, clearing, memo);
      const slop = data.usd < 1 ? 0.000001 : 0.02;
      if (got + slop < data.usd) throw new Error(`The transfer was $${got.toFixed(6)}.`);
      const cut = splitFee(got);
      book.fees = usd6((book.fees || 0) + cut.fee);
      const end = (() => {
        const ms = TENOR_MS[data.tenor];
        let at = Math.ceil(Date.now() / ms) * ms;
        if (at - Date.now() < 60_000) at += ms;
        return at;
      })();
      let race = book.races.find((r) => r.status === "open" && r.left === data.left && r.right === data.right && r.tenor === data.tenor && r.windowEnd === end);
      if (!race) {
        race = {
          id: `${data.left}-${data.right}-${data.tenor}-${end}`,
          left: data.left,
          leftMint: data.leftMint,
          leftOpen: await markOf(data.leftMint),
          right: data.right,
          rightMint: data.rightMint,
          rightOpen: await markOf(data.rightMint),
          tenor: data.tenor,
          windowEnd: end,
          leftLegs: [],
          rightLegs: [],
          status: "open",
        };
        book.races.unshift(race);
      }
      const leg = { owner: data.owner, usd: cut.wager, sig: data.sig };
      if (data.side === "left") race.leftLegs.push(leg);
      else race.rightLegs.push(leg);
      book.sigs.push(data.sig);
      writeBook(book);
      return { id: race.id, leftOpen: race.leftOpen, rightOpen: race.rightOpen, windowEnd: race.windowEnd };
    });
  });

export const settleRace = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ owner: z.string().min(32), id: z.string().min(4) }).parse(input))
  .handler(async ({ data }) => {
    return lock(async () => {
      const kp = house();
      const clearing = kp.publicKey.toBase58();
      const book = await expireFlight(readBook(), clearing);
      if (book.flight) {
        if (book.flight.kind === "race" && book.flight.id === data.id) return { tx: book.flight.tx, usd: book.flight.usd };
        throw new Error("Another payout is waiting for a signature.");
      }
      const race = book.races.find((r) => r.id === data.id && r.status === "open");
      if (!race) throw new Error("That race is not open.");
      if (Date.now() < race.windowEnd) throw new Error("The clock has not finished.");
      const leftNow = await markOf(race.leftMint);
      const rightNow = await markOf(race.rightMint);
      const leftMove = race.leftOpen > 0 ? Math.abs(leftNow - race.leftOpen) / race.leftOpen : 0;
      const rightMove = race.rightOpen > 0 ? Math.abs(rightNow - race.rightOpen) / race.rightOpen : 0;
      const leftUsd = race.leftLegs.reduce((s, l) => s + l.usd, 0);
      const rightUsd = race.rightLegs.reduce((s, l) => s + l.usd, 0);
      const sends: Array<{ to: string; usd: number }> = [];
      const add = (to: string, usd: number) => {
        const row = sends.find((s) => s.to === to);
        if (row) row.usd = Math.round((row.usd + usd) * 100) / 100;
        else sends.push({ to, usd: Math.round(usd * 100) / 100 });
      };
      const credit = (leg: Leg, usd: number) => {
        if (leg.sig.startsWith("purse:")) {
          const purse = (book.purses || []).find((p) => p.id === leg.sig.slice(6) && p.owner === leg.owner);
          if (purse) purse.usd = usd6(purse.usd + usd);
          return;
        }
        add(leg.owner, usd);
      };
      const push = Math.abs(leftMove - rightMove) < 0.00005 || leftUsd <= 0 || rightUsd <= 0;
      if (push) {
        for (const leg of [...race.leftLegs, ...race.rightLegs]) credit(leg, leg.usd);
      } else {
        const win = leftMove > rightMove ? race.leftLegs : race.rightLegs;
        const pot = leftUsd + rightUsd;
        const base = leftMove > rightMove ? leftUsd : rightUsd;
        for (const leg of win) credit(leg, (leg.usd / base) * pot);
      }
      if (sends.length === 0) {
        race.status = "settled";
        writeBook(book);
        return { tx: "", usd: 0, leftMove, rightMove, leftWins: leftMove > rightMove && !push };
      }
      const tx = await payoutTx(data.owner, kp, sends);
      const total = Math.round(sends.reduce((s, x) => s + x.usd, 0) * 100) / 100;
      book.flight = { kind: "race", id: race.id, usd: total, at: Date.now(), tx };
      writeBook(book);
      return { tx, usd: total, leftMove, rightMove, leftWins: leftMove > rightMove && !push };
    });
  });

export const fundPurse = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      owner: z.string().min(32).max(48),
      sig: z.string().min(32),
      name: z.string().min(1).max(32),
      usd: z.number().min(0.001).max(1_000_000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    return lock(async () => {
      const kp = house();
      const clearing = kp.publicKey.toBase58();
      const book = await expireFlight(readBook(), clearing);
      if (book.sigs.includes(data.sig)) throw new Error("That deposit is already in a balance.");
      const memo = `Senda clear purse ${data.name.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 24)}`;
      const got = await depositOf(data.sig, data.owner, clearing, memo);
      const slop = data.usd < 1 ? 0.000001 : 0.02;
      if (got + slop < data.usd) throw new Error(`The transfer was $${got.toFixed(6)}.`);
      const cut = splitFee(got);
      book.fees = usd6((book.fees || 0) + cut.fee);
      const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "agent";
      const key = `${data.owner}:${id}`;
      let purse = book.purses.find((p) => p.id === key);
      if (!purse) {
        purse = { id: key, owner: data.owner, name: data.name.slice(0, 32), usd: 0 };
        book.purses.push(purse);
      }
      purse.usd = usd6(purse.usd + cut.wager);
      book.sigs.push(data.sig);
      writeBook(book);
      return { id: purse.id, usd: purse.usd };
    });
  });

export const agentStake = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      owner: z.string().min(32).max(48),
      purseId: z.string().min(4).max(80),
      symbol: z.string().min(1).max(24),
      mint: z.string().min(32).max(48),
      tenor: z.enum(["15m", "1h", "4h", "1d"]),
      side: z.enum(["yes", "no"]),
      usd: z.number().min(0.001).max(1_000_000),
      strike: z.number().min(0).max(1_000_000).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    return lock(async () => {
      const kp = house();
      const clearing = kp.publicKey.toBase58();
      const book = await expireFlight(readBook(), clearing);
      const purse = book.purses.find((p) => p.id === data.purseId && p.owner === data.owner);
      if (!purse) throw new Error("That balance is not on this wallet.");
      if (purse.usd + 0.000001 < data.usd) throw new Error(`The balance is $${purse.usd.toFixed(4)}.`);
      const strike = Math.round((data.strike || 0) * 100) / 100;
      const end = (() => {
        const ms = TENOR_MS[data.tenor];
        let at = Math.ceil(Date.now() / ms) * ms;
        if (at - Date.now() < 60_000) at += ms;
        return at;
      })();
      let contract = book.preds.find(
        (c) => c.status === "open" && c.symbol === data.symbol && c.tenor === data.tenor && c.windowEnd === end && (c.strike || 0) === strike && (c.style || "line") === "line" && !(c.hi && c.hi > 0),
      );
      if (!contract) {
        contract = {
          id: `${data.symbol}-${data.tenor}-line-${strike || "open"}-0-${end}`,
          symbol: data.symbol,
          mint: data.mint,
          tenor: data.tenor,
          windowEnd: end,
          openPrice: await markOf(data.mint, data.symbol),
          strike,
          style: "line",
          hi: 0,
          yes: [],
          no: [],
          status: "open",
        };
        book.preds.unshift(contract);
      }
      purse.usd = usd6(purse.usd - data.usd);
      const sig = `purse:${purse.id}`;
      contract[data.side].push({ owner: data.owner, usd: data.usd, sig });
      writeBook(book);
      return { id: contract.id, left: purse.usd };
    });
  });


