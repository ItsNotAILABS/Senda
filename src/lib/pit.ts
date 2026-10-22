import { createServerFn } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import {
  LmsrError,
  applyTrade,
  priceYes,
  quoteSpend,
  type Side,
} from "@/lib/lmsr";
import {
  buyInLegs,
  cashOutLegs,
  isFrozen,
  round2,
  tradeLegs,
  type LedgerLeg,
} from "@/lib/ledger";
import {
  BUY_IN_CHIPS,
  GUEST_USER_ID,
  HOUSE_USER_ID,
  MAX_SPEND,
  MAX_STACK,
  TABLES,
  allKnownTables,
  currentCatalog,
  getTable,
  liveToTable,
  loadCatalog,
  rememberTable,
  type MarketStatus,
  type TableDef,
} from "@/lib/markets";
import {
  searchLiveMarkets,
  type LiveMarket,
  type Venue,
} from "@/lib/feeds";


const sideSchema = z.enum(["yes", "no"]);
const marketIdSchema = z.string().min(1).max(48);
const venueSchema = z.enum(["tessera", "prestocks", "polymarket", "kalshi", "manifold"]);
const liveMarketSchema = z.object({
  id: marketIdSchema,
  venue: venueSchema,
  venueKey: z.string().min(1).max(120),
  name: z.string().min(1).max(80),
  question: z.string().min(1).max(800),
  resolveBy: z.string().min(1).max(32),
  streetYes: z.number().min(0).max(1),
  volume: z.number().nonnegative(),
  url: z
    .string()
    .max(500)
    .refine((u) => u.startsWith("https://"), "https only"),
  blurb: z.string().max(300),
  bidYes: z.number().min(0).max(1).nullable().optional(),
  askYes: z.number().min(0).max(1).nullable().optional(),
  lastYes: z.number().min(0).max(1).nullable().optional(),
  liquidity: z.number().nonnegative().optional(),
  volume24h: z.number().nonnegative().optional(),
  openInterest: z.number().nonnegative().optional(),
  change24h: z.number().nullable().optional(),
  tokenYes: z.string().max(200).optional(),
  conditionId: z.string().max(200).optional(),
  seriesTicker: z.string().max(80).optional(),
  description: z.string().max(2000).optional(),
  rules: z.string().max(8000).optional(),
  spread: z.number().min(0).max(1).nullable().optional(),
  lastUsd: z.number().nonnegative().optional(),
  markUsd: z.number().nonnegative().optional(),
  premium: z.number().nullable().optional(),
  holders: z.number().nonnegative().optional(),
  valuation: z.number().nonnegative().optional(),
  swapUrl: z.string().max(500).optional(),
  mint: z.string().max(80).optional(),
  sector: z.string().max(80).optional(),
});


export type MarketView = {
  id: string;
  name: string;
  question: string;
  resolveBy: string;
  qYes: number;
  qNo: number;
  b: number;
  status: MarketStatus;
  pYes: number;
  blurb: string;
  venue: Venue;
  venueKey: string;
  streetYes: number;
  volume: number;
  url: string;
  bidYes: number | null;
  askYes: number | null;
  lastYes: number | null;
  liquidity: number;
  volume24h: number;
  openInterest: number;
  change24h: number | null;
  tokenYes: string;
  conditionId: string;
  seriesTicker: string;
  description: string;
  rules: string;
  spread: number | null;
  lastUsd: number;
  markUsd: number;
  premium: number | null;
  holders: number;
  valuation: number;
  swapUrl: string;
  mint: string;
  sector: string;
};


export type PositionView = {
  marketId: string;
  yesShares: number;
  noShares: number;
};

export type JournalLine = {
  id: number;
  userId: string;
  account: string;
  dr: number;
  cr: number;
  ref: string;
  createdAt: string;
};

export type PitSnapshot = {
  markets: MarketView[];
  chips: number | null;
  positions: PositionView[];
  variance: number;
  frozen: boolean;
  signedIn: boolean;
  totals: { dr: number; cr: number };
};

export type TradeResult =
  | {
      ok: true;
      cost: number;
      shares: number;
      pYes: number;
      pYesAfter: number;
      chips: number | null;
      legs: LedgerLeg[];
      ref: string;
      frozen: boolean;
      variance: number;
    }
  | { ok: false; error: string; frozen?: boolean };

export type BuyInResult =
  | { ok: true; chips: number | null; legs: LedgerLeg[]; ref: string }
  | { ok: false; error: string; frozen?: boolean };

export type CashOutResult =
  | { ok: true; chips: 0; legs: LedgerLeg[]; ref: string; cashed: number }
  | { ok: false; error: string; frozen?: boolean };

export type JournalSnapshot = {
  lines: JournalLine[];
  variance: number;
  frozen: boolean;
  totals: { dr: number; cr: number };
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asIso(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return new Date().toISOString();
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const withSession = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const token = (context as { bearerToken?: string }).bearerToken;
    const user = await getSessionUser(token);
    return next({ context: { userId: user?.id ?? null as string | null } });
  });

function viewFrom(t: TableDef, qYes: number, qNo: number, b: number, status: MarketStatus): MarketView {
  return {
    id: t.id,
    name: t.name,
    question: t.question,
    resolveBy: t.resolveBy,
    qYes,
    qNo,
    b,
    status,
    pYes: priceYes(qYes, qNo, b),
    blurb: t.blurb,
    venue: t.venue,
    venueKey: t.venueKey,
    streetYes: t.streetYes,
    volume: t.volume,
    url: t.url,
    bidYes: t.bidYes ?? null,
    askYes: t.askYes ?? null,
    lastYes: t.lastYes ?? t.streetYes,
    liquidity: t.liquidity ?? 0,
    volume24h: t.volume24h ?? t.volume,
    openInterest: t.openInterest ?? 0,
    change24h: t.change24h ?? null,
    tokenYes: t.tokenYes ?? "",
    conditionId: t.conditionId ?? "",
    seriesTicker: t.seriesTicker ?? "",
    description: t.description ?? "",
    rules: t.rules ?? "",
    spread: t.spread ?? null,
    lastUsd: t.lastUsd ?? 0,
    markUsd: t.markUsd ?? 0,
    premium: t.premium ?? null,
    holders: t.holders ?? 0,
    valuation: t.valuation ?? 0,
    swapUrl: t.swapUrl ?? "",
    mint: t.mint ?? "",
    sector: t.sector ?? "",
  };
}

async function upsertMeta(sql: Sql, t: TableDef): Promise<void> {
  await sql`
    insert into market_meta (
      market_id, venue, venue_key, name, question, resolve_by,
      street_yes, volume, url, blurb, updated_at,
      token_yes, condition_id, series_ticker, description, rules
    )
    values (
      ${t.id}, ${t.venue}, ${t.venueKey}, ${t.name}, ${t.question}, ${t.resolveBy},
      ${t.streetYes}, ${t.volume}, ${t.url}, ${t.blurb}, now(),
      ${t.tokenYes ?? ""}, ${t.conditionId ?? ""}, ${t.seriesTicker ?? ""},
      ${t.description ?? ""}, ${t.rules ?? ""}
    )
    on conflict (market_id) do update set
      street_yes = excluded.street_yes,
      volume = excluded.volume,
      url = excluded.url,
      token_yes = excluded.token_yes,
      condition_id = excluded.condition_id,
      series_ticker = excluded.series_ticker,
      description = excluded.description,
      rules = excluded.rules,
      updated_at = now()
  `;
}

async function ensureMarkets(sql: Sql, tables: TableDef[]): Promise<void> {
  for (const t of tables) {
    rememberTable(t);
    await sql`
      insert into market_state (market_id, q_yes, q_no, b, status)
      values (${t.id}, ${t.qYes}, ${t.qNo}, ${t.b}, ${t.status})
      on conflict (market_id) do nothing
    `;
  }
}

async function persistMeta(sql: Sql, tables: TableDef[]): Promise<void> {
  for (const t of tables) {
    try {
      await upsertMeta(sql, t);
    } catch {
      /* 0004 not applied yet */
    }
  }
}

async function loadMetaTables(sql: Sql): Promise<TableDef[]> {
  try {
    const rows = await sql<{
      market_id: string;
      venue: string;
      venue_key: string;
      name: string;
      question: string;
      resolve_by: string;
      street_yes: string | number;
      volume: string | number;
      url: string;
      blurb: string;
      token_yes?: string;
      condition_id?: string;
      series_ticker?: string;
      description?: string;
      rules?: string;
    }>`
      select market_id, venue, venue_key, name, question, resolve_by,
             street_yes, volume, url, blurb,
             token_yes, condition_id, series_ticker, description, rules
      from market_meta
      order by updated_at desc
      limit 24
    `;
    return rows.map((r) => {
      const streetYes = num(r.street_yes) || 0.5;
      const t = liveToTable({
        id: r.market_id,
        venue: (r.venue as Venue) || "polymarket",
        venueKey: r.venue_key,
        name: r.name,
        question: r.question,
        resolveBy: r.resolve_by,
        streetYes,
        volume: num(r.volume),
        url: r.url,
        blurb: r.blurb,
        bidYes: null,
        askYes: null,
        lastYes: streetYes,
        liquidity: 0,
        volume24h: num(r.volume),
        openInterest: 0,
        change24h: null,
        tokenYes: r.token_yes ?? "",
        conditionId: r.condition_id ?? "",
        seriesTicker: r.series_ticker ?? "",
        description: r.description ?? "",
        rules: r.rules ?? "",
        spread: null,
        lastUsd: 0,
        markUsd: 0,
        premium: null,
        holders: 0,
        valuation: 0,
        swapUrl: "",
        mint: r.venue === "tessera" || r.venue === "prestocks" ? r.venue_key : "",
        sector: "",
      });
      rememberTable(t);
      return t;
    });
  } catch {
    return [];
  }
}

function mergeTables(primary: TableDef[], extra: TableDef[]): TableDef[] {
  const seen = new Set(primary.map((t) => t.id));
  const out = [...primary];
  for (const t of extra) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}


async function readVariance(sql: Sql): Promise<{ dr: number; cr: number; variance: number }> {
  const rows = await sql<{ dr: string | number; cr: string | number }>`
    select coalesce(sum(dr), 0) as dr, coalesce(sum(cr), 0) as cr from ledger_entries
  `;
  const dr = round2(num(rows[0]?.dr));
  const cr = round2(num(rows[0]?.cr));
  return { dr, cr, variance: round2(dr - cr) };
}

async function insertLegs(sql: Sql, userId: string, legs: LedgerLeg[]): Promise<void> {
  for (const leg of legs) {
    await sql`
      insert into ledger_entries (user_id, account, dr, cr, ref)
      values (${userId}, ${leg.account}, ${leg.dr}, ${leg.cr}, ${leg.ref})
    `;
  }
}

async function loadMarkets(sql: Sql, tables: TableDef[]): Promise<MarketView[]> {
  const rows = await sql<{
    market_id: string;
    q_yes: string | number;
    q_no: string | number;
    b: string | number;
    status: string;
  }>`
    select market_id, q_yes, q_no, b, status from market_state
  `;
  const byId = new Map(rows.map((r) => [r.market_id, r]));
  return tables.map((t) => {
    const row = byId.get(t.id);
    const qYes = row ? num(row.q_yes) : t.qYes;
    const qNo = row ? num(row.q_no) : t.qNo;
    const b = row ? num(row.b) : t.b;
    const status = (row?.status as MarketStatus) || t.status;
    return viewFrom(t, qYes, qNo, b, status);
  });
}


async function loadChips(sql: Sql, userId: string): Promise<number> {
  const rows = await sql<{ chips: number }>`
    select chips from chip_stacks where user_id = ${userId} limit 1
  `;
  return Math.round(num(rows[0]?.chips));
}

async function loadPositions(sql: Sql, userId: string): Promise<PositionView[]> {
  const rows = await sql<{
    market_id: string;
    yes_shares: string | number;
    no_shares: string | number;
  }>`
    select market_id, yes_shares, no_shares from positions where user_id = ${userId}
  `;
  return rows.map((r) => ({
    marketId: r.market_id,
    yesShares: num(r.yes_shares),
    noShares: num(r.no_shares),
  }));
}

function newRef(kind: string, extra: string): string {
  const n =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${kind}:${extra}:${n}`;
}

async function snapshotFor(sql: Sql, userId: string | null): Promise<PitSnapshot> {
  const tables = await loadCatalog();
  const extras = await loadMetaTables(sql);
  const all = mergeTables(tables, extras);
  await ensureMarkets(sql, all);
  void persistMeta(sql, tables).catch(() => undefined);
  const markets = await loadMarkets(sql, all);
  const totals = await readVariance(sql);
  const signedIn = Boolean(userId);
  const chips = signedIn && userId ? await loadChips(sql, userId) : null;
  const positions = signedIn && userId ? await loadPositions(sql, userId) : [];
  return {
    markets,
    chips,
    positions,
    variance: totals.variance,
    frozen: isFrozen(totals.variance),
    signedIn,
    totals: { dr: totals.dr, cr: totals.cr },
  };
}

function fallbackSnap(userId: string | null): PitSnapshot {
  const tables = currentCatalog().length ? currentCatalog() : TABLES;
  return {
    markets: tables.map((t) => viewFrom(t, t.qYes, t.qNo, t.b, t.status)),
    chips: null,
    positions: [],
    variance: 0,
    frozen: false,
    signedIn: Boolean(userId),
    totals: { dr: 0, cr: 0 },
  };
}

export const getPit = createServerFn({ method: "GET" })
  .middleware([withSession])
  .handler(async ({ context }): Promise<PitSnapshot> => {
    try {
      const sql = await getSql();
      return await snapshotFor(sql, context.userId);
    } catch (err) {
      console.error("[pit] getPit failed", err);
      return fallbackSnap(context.userId);
    }
  });

export const searchBooks = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        query: z.string().max(80).optional().default(""),
        venue: z.enum(["all", "tessera", "prestocks", "polymarket", "kalshi", "manifold"]).optional().default("all"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LiveMarket[]> => {
    return searchLiveMarkets(data.query, data.venue, 24);
  });

export const sitBook = createServerFn({ method: "POST" })
  .validator((input: unknown) => liveMarketSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; market: MarketView } | { ok: false; error: string }> => {
    const sql = await getSql();
    const table = liveToTable(data as LiveMarket);
    rememberTable(table);
    try {
      await ensureMarkets(sql, [table]);
      await persistMeta(sql, [table]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not open that book.";
      return { ok: false, error: message };
    }
    const views = await loadMarkets(sql, [table]);
    const market = views[0];
    if (!market) return { ok: false, error: "Book not open." };
    return { ok: true, market };
  });

export const getBook = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: marketIdSchema }).parse(input))
  .handler(async ({ data }): Promise<MarketView | null> => {
    const sql = await getSql();
    const tables = await loadCatalog();
    const extras = await loadMetaTables(sql);
    const all = mergeTables(tables, extras);
    await ensureMarkets(sql, all);
    const found = all.find((t) => t.id === data.id);
    if (!found) return null;
    const views = await loadMarkets(sql, [found]);
    return views[0] ?? null;
  });

export const getJournal = createServerFn({ method: "GET" })
  .middleware([withSession])
  .handler(async (): Promise<JournalSnapshot> => {
    const sql = await getSql();
    const tables = await loadCatalog();
    await ensureMarkets(sql, tables);
    const totals = await readVariance(sql);
    const rows = await sql<{
      id: number;
      user_id: string;
      account: string;
      dr: string | number;
      cr: string | number;
      ref: string;
      created_at: string | Date;
    }>`
      select id, user_id, account, dr, cr, ref, created_at
      from ledger_entries
      order by id desc
      limit 24
    `;
    return {
      lines: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        account: r.account,
        dr: num(r.dr),
        cr: num(r.cr),
        ref: r.ref,
        createdAt: asIso(r.created_at),
      })),
      variance: totals.variance,
      frozen: isFrozen(totals.variance),
      totals: { dr: totals.dr, cr: totals.cr },
    };
  });

export const paperCredit = createServerFn({ method: "POST" })
  .middleware([withSession])
  .validator((input: unknown) =>
    z
      .object({
        amount: z.number().int().positive().max(5_000),
        ref: z.string().min(1).max(80),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<BuyInResult> => {
    const sql = await getSql();
    const totals = await readVariance(sql);
    if (isFrozen(totals.variance)) {
      return { ok: false, error: "Cage frozen — ledger variance is not zero.", frozen: true };
    }
    const userId = context.userId ?? GUEST_USER_ID;
    const signedIn = Boolean(context.userId);
    const ref = data.ref;
    const legs = buyInLegs(data.amount, ref);
    if (signedIn) {
      await sql`
        insert into chip_stacks (user_id, chips, updated_at)
        values (${userId}, ${data.amount}, now())
        on conflict (user_id) do update
          set chips = chip_stacks.chips + ${data.amount},
              updated_at = now()
      `;
      await insertLegs(sql, userId, legs);
      const chips = await loadChips(sql, userId);
      return { ok: true, chips, legs, ref };
    }
    await insertLegs(sql, GUEST_USER_ID, legs);
    return { ok: true, chips: null, legs, ref };
  });

export const paperDebit = createServerFn({ method: "POST" })
  .middleware([withSession])
  .validator((input: unknown) =>
    z
      .object({
        amount: z.number().int().positive().max(MAX_SPEND),
        ref: z.string().min(1).max(80),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<BuyInResult> => {
    const sql = await getSql();
    const totals = await readVariance(sql);
    if (isFrozen(totals.variance)) {
      return { ok: false, error: "Cage frozen — ledger variance is not zero.", frozen: true };
    }
    const userId = context.userId ?? GUEST_USER_ID;
    const signedIn = Boolean(context.userId);
    const ref = data.ref;
    const legs = cashOutLegs(data.amount, ref);
    if (signedIn) {
      const updated = await sql<{ chips: number }>`
        update chip_stacks
        set chips = chips - ${data.amount}, updated_at = now()
        where user_id = ${userId} and chips >= ${data.amount}
        returning chips
      `;
      if (!updated[0]) return { ok: false, error: "Not enough chips." };
      await insertLegs(sql, userId, legs);
      return { ok: true, chips: Math.round(num(updated[0].chips)), legs, ref };
    }
    await insertLegs(sql, GUEST_USER_ID, legs);
    return { ok: true, chips: null, legs, ref };
  });

export const buyIn = createServerFn({ method: "POST" })
  .middleware([withSession])
  .handler(async ({ context }): Promise<BuyInResult> => {
    const sql = await getSql();
    await ensureMarkets(sql, currentCatalog());
    const totals = await readVariance(sql);
    if (isFrozen(totals.variance)) {
      return { ok: false, error: "Cage frozen — ledger variance is not zero.", frozen: true };
    }
    const userId = context.userId ?? GUEST_USER_ID;
    const signedIn = Boolean(context.userId);
    const ref = newRef("buyin", userId);
    const legs = buyInLegs(BUY_IN_CHIPS, ref);

    if (signedIn) {
      const current = await loadChips(sql, userId);
      if (current + BUY_IN_CHIPS > MAX_STACK) {
        return { ok: false, error: `Stack cap is ${MAX_STACK} chips.` };
      }
      await sql`
        insert into chip_stacks (user_id, chips, updated_at)
        values (${userId}, ${BUY_IN_CHIPS}, now())
        on conflict (user_id) do update
          set chips = chip_stacks.chips + ${BUY_IN_CHIPS},
              updated_at = now()
      `;
      await insertLegs(sql, userId, legs);
      const chips = await loadChips(sql, userId);
      return { ok: true, chips, legs, ref };
    }

    await insertLegs(sql, GUEST_USER_ID, legs);
    return { ok: true, chips: null, legs, ref };
  });

export const cashOut = createServerFn({ method: "POST" })
  .middleware([withSession])
  .handler(async ({ context }): Promise<CashOutResult> => {
    const sql = await getSql();
    await ensureMarkets(sql, currentCatalog());
    const totals = await readVariance(sql);
    if (isFrozen(totals.variance)) {
      return { ok: false, error: "Cage frozen — ledger variance is not zero.", frozen: true };
    }
    const userId = context.userId;
    if (!userId) {
      return { ok: false, error: "Guest cash-out is local — no server stack." };
    }
    const current = await loadChips(sql, userId);
    if (current <= 0) return { ok: false, error: "No chips to cash out." };
    const ref = newRef("cashout", userId);
    const legs = cashOutLegs(current, ref);
    await sql`
      update chip_stacks set chips = 0, updated_at = now() where user_id = ${userId}
    `;
    await insertLegs(sql, userId, legs);
    return { ok: true, chips: 0, legs, ref, cashed: current };
  });

const tradeInput = z.object({
  marketId: marketIdSchema,
  side: sideSchema,
  spend: z.number().int().positive().max(MAX_SPEND),
});

export const trade = createServerFn({ method: "POST" })
  .middleware([withSession])
  .validator((input: unknown) => tradeInput.parse(input))
  .handler(async ({ context, data }): Promise<TradeResult> => {
    const sql = await getSql();
    let tables = allKnownTables();
    if (!getTable(data.marketId)) tables = await loadCatalog();
    const extras = await loadMetaTables(sql);
    tables = mergeTables(tables, extras);
    await ensureMarkets(sql, tables);
    const totals = await readVariance(sql);
    if (isFrozen(totals.variance)) {
      return { ok: false, error: "Table frozen — ledger variance is not zero.", frozen: true };
    }

    const def = getTable(data.marketId) ?? extras.find((t) => t.id === data.marketId);
    if (!def) {
      const rows = await sql<{ market_id: string }>`
        select market_id from market_state where market_id = ${data.marketId} limit 1
      `;
      if (!rows[0]) return { ok: false, error: "Unknown table." };
    }

    const rows = await sql<{
      q_yes: string | number;
      q_no: string | number;
      b: string | number;
      status: string;
    }>`
      select q_yes, q_no, b, status from market_state where market_id = ${data.marketId} limit 1
    `;
    const row = rows[0];
    if (!row) return { ok: false, error: "Book not open." };
    if (row.status !== "open") return { ok: false, error: "This table is not open." };

    const qYes = num(row.q_yes);
    const qNo = num(row.q_no);
    const b = num(row.b);
    const side = data.side as Side;

    let quote;
    try {
      quote = quoteSpend(qYes, qNo, b, side, data.spend);
    } catch (err) {
      const message = err instanceof LmsrError ? err.message : "Trade rejected.";
      return { ok: false, error: message };
    }

    const charge = Math.max(1, Math.round(quote.cost));
    const userId = context.userId;
    const signedIn = Boolean(userId);
    const bookUser = userId ?? GUEST_USER_ID;

    if (signedIn && userId) {
      const stack = await loadChips(sql, userId);
      if (stack < charge) {
        return { ok: false, error: "Not enough chips." };
      }
    }

    const ref = newRef(`trade:${data.marketId}:${side}`, bookUser);
    const legs = tradeLegs(side, charge, quote.shares, ref);

    await sql`
      update market_state
      set q_yes = ${quote.qYes},
          q_no = ${quote.qNo},
          updated_at = now()
      where market_id = ${data.marketId} and status = 'open'
    `;

    if (signedIn && userId) {
      const updated = await sql<{ chips: number }>`
        update chip_stacks
        set chips = chips - ${charge}, updated_at = now()
        where user_id = ${userId} and chips >= ${charge}
        returning chips
      `;
      if (!updated[0]) {
        return { ok: false, error: "Not enough chips." };
      }
      const yesAdd = side === "yes" ? quote.shares : 0;
      const noAdd = side === "no" ? quote.shares : 0;
      await sql`
        insert into positions (user_id, market_id, yes_shares, no_shares)
        values (${userId}, ${data.marketId}, ${yesAdd}, ${noAdd})
        on conflict (user_id, market_id) do update
          set yes_shares = positions.yes_shares + ${yesAdd},
              no_shares = positions.no_shares + ${noAdd}
      `;
      await insertLegs(sql, userId, legs);
      const after = await readVariance(sql);
      return {
        ok: true,
        cost: charge,
        shares: quote.shares,
        pYes: quote.pYes,
        pYesAfter: quote.pYesAfter,
        chips: Math.round(num(updated[0].chips)),
        legs,
        ref,
        frozen: isFrozen(after.variance),
        variance: after.variance,
      };
    }

    await insertLegs(sql, GUEST_USER_ID, legs);
    const after = await readVariance(sql);
    return {
      ok: true,
      cost: charge,
      shares: quote.shares,
      pYes: quote.pYes,
      pYesAfter: quote.pYesAfter,
      chips: null,
      legs,
      ref,
      frozen: isFrozen(after.variance),
      variance: after.variance,
    };
  });

export const tickHouse = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    moved: Array<{ marketId: string; side: Side; shares: number; pYes: number }>;
    frozen: boolean;
    variance: number;
  }> => {
    const sql = await getSql();
    await ensureMarkets(sql, currentCatalog());
    const totals = await readVariance(sql);
    if (isFrozen(totals.variance)) {
      return { moved: [], frozen: true, variance: totals.variance };
    }

    const rows = await sql<{
      market_id: string;
      q_yes: string | number;
      q_no: string | number;
      b: string | number;
      status: string;
      updated_at: string | Date;
    }>`
      select market_id, q_yes, q_no, b, status, updated_at from market_state
    `;

    const moved: Array<{ marketId: string; side: Side; shares: number; pYes: number }> = [];
    const now = Date.now();

    for (const row of rows) {
      if (row.status !== "open") continue;
      const updated = Date.parse(asIso(row.updated_at));
      const age = Number.isFinite(updated) ? now - updated : 9_000;
      const stagger = hash32(row.market_id) % 2500;
      if (age < 8000 + stagger) continue;

      const bucket = Math.floor(now / 8000);
      const rng = mulberry32(hash32(`${row.market_id}:${bucket}`));
      const side: Side = rng() < 0.5 ? "yes" : "no";
      const shares = 1 + Math.floor(rng() * 5);
      const qYes = num(row.q_yes);
      const qNo = num(row.q_no);
      const b = num(row.b);

      try {
        const quote = applyTrade(qYes, qNo, b, side, shares);
        const charge = round2(quote.cost);
        const ref = `house:${row.market_id}:${bucket}`;
        const legs = tradeLegs(side, Math.max(charge, 0.01), quote.shares, ref);

        const wrote = await sql<{ market_id: string }>`
          update market_state
          set q_yes = ${quote.qYes},
              q_no = ${quote.qNo},
              updated_at = now()
          where market_id = ${row.market_id} and status = 'open'
          returning market_id
        `;
        if (!wrote[0]) continue;
        await insertLegs(sql, HOUSE_USER_ID, legs);
        moved.push({
          marketId: row.market_id,
          side,
          shares: quote.shares,
          pYes: quote.pYesAfter,
        });
      } catch {
        await sql`
          update market_state set updated_at = now() where market_id = ${row.market_id}
        `;
      }
    }

    const after = await readVariance(sql);
    return { moved, frozen: isFrozen(after.variance), variance: after.variance };
  },
);
