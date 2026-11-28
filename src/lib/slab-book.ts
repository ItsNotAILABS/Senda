/** Collector Crypt public marketplace and gacha. Senda does not hold the card or the pack. */

import { VersionedTransaction } from "@solana/web3.js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MARKET = "https://api.collectorcrypt.com/marketplace";
const BUY = "https://api.collectorcrypt.com/marketplace/buy";
const GACHA = "https://gacha.collectorcrypt.com";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const CC = "CcmRKTuZCGJBWQwMHvDYApBRvSZNHqGJXkznqpDTSQUr";

const CATS = [
  "Pokemon",
  "One Piece",
  "Baseball",
  "Basketball",
  "Football",
  "Soccer",
  "Lorcana",
  "Dragon Ball",
  "Marvel",
  "Yu-Gi-Oh!",
  "Watch",
  "Moonbirds",
  "Riftbound",
  "Gundam",
] as const;

const GRADES = ["PSA", "CGC", "Beckett", "BGS"] as const;

export type Slab = {
  mint: string;
  name: string;
  category: string;
  kind: string;
  grade: string;
  company: string;
  cert: string;
  insured: number | null;
  year: string;
  set: string;
  vault: string;
  ask: number;
  image: string;
  full: string;
  back: string;
};

export type Pack = {
  code: string;
  name: string;
  price: number;
  category: string;
  image: string;
  stock: number;
  ev: number | null;
  buyback: number | null;
  odds: { common: number; uncommon: number; rare: number; epic: number };
};

const walletZ = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function absMedia(url: string): string {
  if (!url) return "";
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  if (url.startsWith("/")) return `https://gacha.collectorcrypt.com${url}`;
  return "";
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function junk(name: string): boolean {
  return /do not buy|\btest\b/i.test(name);
}

function asSlab(raw: unknown): Slab | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const listing = row.listing && typeof row.listing === "object" ? (row.listing as Record<string, unknown>) : null;
  const ask = num(listing?.price);
  const currency = str(listing?.currency) || "USDC";
  const mint = str(row.nftAddress);
  const name = str(row.itemName);
  if (!mint || !name || junk(name) || ask == null || !(ask > 0) || currency !== "USDC") return null;
  const images = row.images && typeof row.images === "object" ? (row.images as Record<string, unknown>) : {};
  const front = str(images.frontM) || str(images.frontS) || str(row.frontImage);
  return {
    mint,
    name,
    category: str(row.category),
    kind: str(row.type) || "Card",
    grade: str(row.grade),
    company: str(row.gradingCompany),
    cert: str(row.gradingID),
    insured: num(row.insuredValue),
    year: row.year == null ? "" : String(row.year),
    set: str(row.set),
    vault: str(row.vault),
    ask,
    image: front,
    full: str(row.frontImage) || front,
    back: str(images.backS) || str(row.backImage),
  };
}

function asPack(raw: unknown): Pack | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.public !== true) return null;
  const code = str(row.code);
  const name = str(row.name);
  const price = num(row.price);
  if (!code || !name || price == null || !(price > 0)) return null;
  const oddsRaw = row.odds && typeof row.odds === "object" ? (row.odds as Record<string, unknown>) : {};
  const stockRaw = row.stock && typeof row.stock === "object" ? (row.stock as Record<string, unknown>) : {};
  const stock = ["common", "uncommon", "rare", "epic"].reduce((sum, key) => sum + (num(stockRaw[key]) ?? 0), 0);
  const ev = num(row.ev);
  const buyback = num(row.instantBuyback);
  return {
    code,
    name,
    price,
    category: str(row.menuCategory) || "Packs",
    image: absMedia(str(row.thumbnailUrl) || str(row.image)),
    stock,
    ev: ev != null && ev > 0 ? ev : null,
    buyback: buyback != null && buyback > 0 ? buyback : null,
    odds: {
      common: num(oddsRaw.common) ?? 0,
      uncommon: num(oddsRaw.uncommon) ?? 0,
      rare: num(oddsRaw.rare) ?? 0,
      epic: num(oddsRaw.epic) ?? 0,
    },
  };
}

async function getText(url: string): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Senda/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, text: await res.text() };
}

async function postRaw(url: string, body: unknown): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/plain",
      "content-type": "application/json",
      origin: "https://collectorcrypt.com",
      "user-agent": "Senda/1.0",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  return { status: res.status, text: await res.text() };
}

function apiError(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { message?: unknown; error?: unknown };
    const m = typeof j.message === "string" ? j.message : typeof j.error === "string" ? j.error : "";
    if (m && m.length < 180 && !m.startsWith("{")) return m;
  } catch {
    /* body was a transaction */
  }
  return fallback;
}

/** USDC leaving the wallet, from the unsigned marketplace or pack transaction. */
export function readMove(b64: string, wallet: string): number {
  const tx = VersionedTransaction.deserialize(Buffer.from(b64, "base64"));
  const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
  if (!keys.includes(USDC)) throw new Error("This transaction does not move USDC. Nothing was signed.");
  const signers = keys.slice(0, tx.message.header.numRequiredSignatures);
  if (!signers.includes(wallet)) throw new Error("This transaction is not for this wallet. Nothing was signed.");
  let usdc: number | null = null;
  for (const ix of tx.message.compiledInstructions) {
    const prog = keys[ix.programIdIndex];
    const data = Buffer.from(ix.data);
    if (prog === TOKEN && data.length >= 10 && data[0] === 12 && data[9] === 6) {
      const amt = Number(data.readBigUInt64LE(1));
      if (amt > 0) usdc = amt / 1e6;
    }
    if (prog === CC && data.length >= 16) {
      const amt = Number(data.readBigUInt64LE(8));
      if (amt > 0 && amt < 1e15) usdc = amt / 1e6;
    }
  }
  if (usdc == null || !(usdc > 0)) throw new Error("Could not read the USDC amount. Nothing was signed.");
  return usdc;
}

function guardPrice(usdc: number, ask: number) {
  if (!(ask > 0) || ask > 5000 || usdc > 5000) throw new Error("That price is over the send cap. Nothing was signed.");
  if (usdc > ask + 0.02) throw new Error("The ask moved above the price on screen. Refresh, then sign.");
}

export const loadSlabs = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(80).optional(),
        category: z.enum(CATS).optional(),
        grade: z.enum(GRADES).optional(),
        cardType: z.enum(["Card", "Sealed", "Merch", "Comic", "Watch"]).optional(),
        orderBy: z.enum(["listedPriceAsc", "listedPriceDesc", "dateDesc"]).optional(),
        page: z.number().int().min(1).max(400).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const u = new URL(MARKET);
    u.searchParams.set("page", String(data.page ?? 1));
    u.searchParams.set("step", "24");
    u.searchParams.set("orderBy", data.orderBy ?? "listedPriceAsc");
    if (data.category) u.searchParams.set("categories", data.category);
    if (data.grade) u.searchParams.set("gradingCompany", data.grade);
    if (data.cardType) u.searchParams.set("cardType", data.cardType);
    const q = (data.q ?? "").trim();
    if (q) u.searchParams.set("search", q);
    const { status, text } = await getText(u.toString());
    if (status !== 200) throw new Error(apiError(text, "Collector Crypt did not return the book."));
    const j = JSON.parse(text) as { filterNFtCard?: unknown[]; findTotal?: number; totalPages?: number };
    const rows = (Array.isArray(j.filterNFtCard) ? j.filterNFtCard : []).map(asSlab).filter((row): row is Slab => !!row);
    return { rows, total: typeof j.findTotal === "number" ? j.findTotal : rows.length, page: data.page ?? 1 };
  });

export const loadPacks = createServerFn({ method: "GET" }).handler(async () => {
  const { status, text } = await getText(`${GACHA}/api/machines`);
  if (status !== 200) throw new Error(apiError(text, "Collector Crypt did not return the machines."));
  const j = JSON.parse(text) as { machines?: unknown[] };
  const rows = (Array.isArray(j.machines) ? j.machines : [])
    .map(asPack)
    .filter((row): row is Pack => !!row)
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  return { rows };
});

export const slabTx = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ wallet: walletZ, nft: walletZ, ask: z.number().positive().max(5000) }).parse(input))
  .handler(async ({ data }) => {
    const { status, text } = await postRaw(BUY, { wallet: data.wallet, nftAddress: data.nft });
    if (status !== 200 && status !== 201) throw new Error(apiError(text, "Collector Crypt did not build a buy."));
    const tx = text.replace(/\s+/g, "");
    if (tx.length < 80 || tx.startsWith("{")) throw new Error(apiError(text, "Collector Crypt did not build a buy."));
    const usdc = readMove(tx, data.wallet);
    guardPrice(usdc, data.ask);
    return { tx, usdc };
  });

export const packTx = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ wallet: walletZ, code: z.string().regex(/^[a-z0-9_]{2,48}$/), ask: z.number().positive().max(5000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { status, text } = await postRaw(`${GACHA}/api/generatePack`, {
      packType: data.code,
      playerAddress: data.wallet,
      slug: "cc",
      turbo: false,
    });
    if (status !== 200) throw new Error(apiError(text, "That machine did not build a pack."));
    const j = JSON.parse(text) as { memo?: unknown; transaction?: unknown };
    const tx = str(j.transaction);
    const memo = str(j.memo);
    if (!tx || !memo.startsWith("cc-")) throw new Error("That machine did not build a pack.");
    const usdc = readMove(tx, data.wallet);
    guardPrice(usdc, data.ask);
    return { tx, memo, usdc };
  });

export const packSend = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ signed: z.string().min(80).max(20000), memo: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const sent = await postRaw(`${GACHA}/api/submitTransaction`, { signedTransaction: data.signed });
    if (sent.status < 200 || sent.status >= 300) throw new Error(apiError(sent.text, "Collector Crypt did not take the signature. Nothing else was sent."));
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(sent.text) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const look = await postRaw(`${GACHA}/api/openPack`, { memo: data.memo });
    let opened: Record<string, unknown> = {};
    if (look.status >= 200 && look.status < 300) {
      try {
        opened = JSON.parse(look.text) as Record<string, unknown>;
      } catch {
        opened = {};
      }
    }
    const pick = (row: Record<string, unknown>, keys: string[]) => {
      for (const key of keys) {
        const v = row[key];
        if (typeof v === "string" && v) return v;
      }
      return "";
    };
    return {
      signature: pick(body, ["signature", "txid", "txId", "tx"]),
      nft: pick(opened, ["nft_address", "nftAddress"]) || pick(body, ["nft_address", "nftAddress"]),
      name: pick(opened, ["itemName", "name"]),
      image: pick(opened, ["frontImage", "image", "thumbnailUrl"]),
      grade: pick(opened, ["grade"]),
    };
  });

export const packLook = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ memo: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const look = await postRaw(`${GACHA}/api/openPack`, { memo: data.memo });
    if (look.status < 200 || look.status >= 300) return { nft: "", name: "", image: "", grade: "" };
    let opened: Record<string, unknown> = {};
    try {
      opened = JSON.parse(look.text) as Record<string, unknown>;
    } catch {
      opened = {};
    }
    const pick = (keys: string[]) => {
      for (const key of keys) {
        const v = opened[key];
        if (typeof v === "string" && v) return v;
      }
      return "";
    };
    return {
      nft: pick(["nft_address", "nftAddress"]),
      name: pick(["itemName", "name"]),
      image: pick(["frontImage", "image", "thumbnailUrl"]),
      grade: pick(["grade"]),
    };
  });
