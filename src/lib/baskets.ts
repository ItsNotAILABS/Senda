/**
 * A basket is a recipe. Python prices it. The program, when it has an address,
 * stores that recipe on devnet. It does not hold the tokens and it does not pay yield.
 */

import { createServerFn } from "@tanstack/react-start";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";

/** Filled only after a deploy writes a real id. Null is not a program. */
export const BASKETS_PROGRAM: string | null = null;

const MSOL = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";

export type BasketGroup = "company" | "crypto" | "listed" | "stake";

export type RecipeLeg = { symbol: string; mint: string; group: BasketGroup; bps: number };

export const RECIPES = [
  {
    id: "universes",
    name: "Four universes",
    line: "A company, a crypto pool, a listed stock, and staked SOL. One receipt.",
    legs: [
      { symbol: "OPENAI", mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", group: "company", bps: 2500 },
      { symbol: "JLP", mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", group: "crypto", bps: 2500 },
      { symbol: "SPYx", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", group: "listed", bps: 2500 },
      { symbol: "mSOL", mint: MSOL, group: "stake", bps: 2500 },
    ],
  },
  {
    id: "stake",
    name: "Stake book",
    line: "Five staked SOL receipts. The only income is a rate a source published.",
    legs: [
      { symbol: "JitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", group: "stake", bps: 2000 },
      { symbol: "mSOL", mint: MSOL, group: "stake", bps: 2000 },
      { symbol: "bSOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", group: "stake", bps: 2000 },
      { symbol: "JupSOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", group: "stake", bps: 2000 },
      { symbol: "INF", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", group: "stake", bps: 2000 },
    ],
  },
] as const;

export type RecipeId = (typeof RECIPES)[number]["id"];

export type BasketLeg = RecipeLeg & {
  price: string;
  usd: string;
  qty: string;
  apy: string | null;
  income: string;
  kind: "carry" | "mark";
};

export type BasketQuote = {
  engine: "python" | "node";
  name: string;
  usd: string;
  income: string;
  carryBps: string;
  legs: BasketLeg[];
  instruction: string | null;
  accountBytes: number;
  proof: string;
  program: string | null;
};

const Ask = z.object({
  id: z.enum(["stake", "universes"]),
  usd: z.number().positive().max(5000),
});

type Payload = {
  name: string;
  usd: string;
  legs: Array<RecipeLeg & { price: string; apy: string | null }>;
};

function pyRoot(): string | null {
  const roots = [join(process.cwd(), "py"), "/workspace/py"];
  return roots.find((dir) => existsSync(join(dir, "senda_baskets", "engine.py"))) ?? null;
}

function runPython(payload: Payload): Promise<Omit<BasketQuote, "engine" | "program">> {
  const root = pyRoot();
  if (!root) return Promise.reject(new Error("no python"));
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-m", "senda_baskets.engine"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("timeout"));
    }, 4000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(Buffer.concat(err).toString().slice(0, 180) || "engine failed"));
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(out).toString()) as { ok?: boolean; error?: string };
        if (!parsed.ok) {
          reject(new Error(parsed.error || "The basket did not price."));
          return;
        }
        resolve(parsed as Omit<BasketQuote, "engine" | "program">);
      } catch {
        reject(new Error("bad engine output"));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

function centsOf(usd: number, bps: number, taken: number, last: boolean, total: number): number {
  if (last) return total - taken;
  const n = (total * bps) / 10_000;
  const floor = Math.floor(n);
  const diff = n - floor;
  if (diff > 0.5 + 1e-9) return floor + 1;
  if (diff < 0.5 - 1e-9) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

function priceOnHost(payload: Payload): Omit<BasketQuote, "engine" | "program"> {
  const usd = Math.round(Number(payload.usd) * 100) / 100;
  const total = Math.round(usd * 100);
  let taken = 0;
  let income = 0;
  const legs: BasketLeg[] = payload.legs.map((leg, index) => {
    const last = index === payload.legs.length - 1;
    const legCents = centsOf(usd, leg.bps, taken, last, total);
    if (!last) taken += legCents;
    const price = Number(leg.price);
    const apy = leg.apy == null ? null : Number(leg.apy);
    const carry = apy != null && apy > 0 ? Math.round(legCents * apy) : 0;
    income += carry;
    return {
      symbol: leg.symbol,
      mint: leg.mint,
      group: leg.group,
      bps: leg.bps,
      price: String(price),
      usd: (legCents / 100).toFixed(2),
      qty: (legCents / 100 / price).toFixed(8),
      apy: apy != null && apy > 0 ? String(apy) : null,
      income: (carry / 100).toFixed(2),
      kind: apy != null && apy > 0 ? "carry" : "mark",
    };
  });
  return {
    name: payload.name,
    usd: usd.toFixed(2),
    income: (income / 100).toFixed(2),
    carryBps: ((income * 10_000) / total).toFixed(2),
    legs,
    instruction: null,
    accountBytes: 291,
    proof: "Priced on this host. Python did not run, so the instruction bytes were not built.",
  };
}

const HEAD = { headers: { accept: "application/json", "user-agent": "Senda/baskets" } };

async function marinade(): Promise<string | null> {
  const hit = await cachedJson("https://api.marinade.finance/msol/apy/30d", 60_000, HEAD).catch(() => null);
  const value = Number((hit?.body as { value?: number } | undefined)?.value);
  if (!hit?.ok || !(value > 0) || value > 0.5) return null;
  return String(value);
}

export const quoteBasket = createServerFn({ method: "POST" })
  .validator((input: unknown) => Ask.parse(input))
  .handler(async ({ data }): Promise<BasketQuote> => {
    const recipe = RECIPES.find((row) => row.id === data.id);
    if (!recipe) throw new Error("That basket is not on the book.");
    const ids = recipe.legs.map((leg) => leg.mint).join(",");
    const priced = await cachedJson(`https://lite-api.jup.ag/price/v3?ids=${ids}`, 20_000, HEAD);
    if (!priced.ok) throw new Error("Prices did not come back.");
    const book = priced.body as Record<string, { usdPrice?: number }>;
    const rate = recipe.legs.some((leg) => leg.mint === MSOL) ? await marinade() : null;
    const legs = recipe.legs.map((leg) => {
      const price = book[leg.mint]?.usdPrice;
      if (!(Number(price) > 0)) throw new Error(`No live print for ${leg.symbol}.`);
      return { ...leg, price: String(price), apy: leg.mint === MSOL ? rate : null };
    });
    const payload: Payload = { name: recipe.name, usd: data.usd.toFixed(2), legs };
    try {
      const out = await runPython(payload);
      return { ...out, engine: "python", program: BASKETS_PROGRAM };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/(amount|weight|name|mint|legs|no live print|rate)/.test(message)) throw err;
      return { ...priceOnHost(payload), engine: "node", program: BASKETS_PROGRAM };
    }
  });
