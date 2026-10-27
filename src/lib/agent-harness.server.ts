/** Harness store. An agent can reserve a budget. It cannot sign. */

import { getSql } from "@/lib/db";
import { SEED_STRATEGIES, agentNames, clipLeft, parseRule, type StrategyCard } from "@/lib/agent-catalog";
import { readRoutes } from "@/lib/mesie-route";
import { shortBook } from "@/lib/short-market";
import { evaluateMatrix, matrixClears } from "@/lib/matrix-engine";
import { feeOn, launchScore, refuseLaunch, type Launch } from "@/lib/launch-gate";
import { poolMatrixBars } from "@/lib/print-bars";
import { receipt, scorePaths } from "@/lib/matdaemon";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export class HarnessError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type MissionRow = {
  id: string;
  strategy_id: string;
  bankroll_usd: number;
  aim_usd: number;
  spent_usd: number;
  day: string;
  day_spent: number;
  status: string;
};

async function sha256(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function harnessId(token: string): Promise<string> {
  if (!token) throw new HarnessError(401, "Send the harness token.");
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>("SELECT id FROM agent_harness WHERE token_hash = $1", [await sha256(token)]);
  if (!rows[0]) throw new HarnessError(401, "That harness token is not recognized.");
  return rows[0].id;
}

function money(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

async function strategyOf(id: string, harness: string): Promise<StrategyCard> {
  const seed = SEED_STRATEGIES.find((row) => row.id === id);
  if (seed) return seed;
  const sql = await getSql();
  const rows = await sql.query<{ id: string; name: string; category: string; thesis: string; rule_json: string; executable: boolean }>(
    "SELECT id, name, category, thesis, rule_json, executable FROM agent_strategy WHERE id = $1 AND harness_id = $2",
    [id, harness],
  );
  const row = rows[0];
  if (!row) throw new HarnessError(404, "No strategy with that id.");
  const rule = parseRule(JSON.parse(row.rule_json)) ?? { kind: "note" as const, side: "buy" as const, symbols: [] };
  return { id: row.id, name: row.name, category: row.category, thesis: row.thesis, rule, executable: Boolean(row.executable) };
}

async function poolUsd(mint: string): Promise<number> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, {
      headers: { accept: "application/json", "user-agent": "Senda" },
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await res.json()) as { id?: string; liquidity?: number }[];
    const hit = (Array.isArray(body) ? body : []).find((row) => row.id === mint);
    return Number(hit?.liquidity) || 0;
  } catch {
    return 0;
  }
}

async function quotePair(mint: string, usd: number, decimals: number, side: "buy" | "sell") {
  let amount = Math.round(usd * 1_000_000);
  let input = USDC;
  let output = mint;
  if (side === "sell") {
    const priced = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { headers: { accept: "application/json" } });
    const book = (await priced.json()) as Record<string, { usdPrice?: number }>;
    const px = Number(book[mint]?.usdPrice);
    if (!(px > 0)) throw new HarnessError(502, "No live price. Nothing was queued.");
    amount = Math.max(1, Math.round((usd / px) * 10 ** decimals));
    input = mint;
    output = USDC;
  }
  const lanes = [true, false];
  const settled = await Promise.all(
    lanes.map(async (direct) => {
      const started = Date.now();
      const lane = direct ? "&onlyDirectRoutes=true" : "&restrictIntermediateTokens=true";
      const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${input}&outputMint=${output}&amount=${amount}&slippageBps=50${lane}`;
      try {
        const res = await fetch(url, { headers: { accept: "application/json" } });
        const body = (await res.json()) as { outAmount?: string; priceImpactPct?: string; routePlan?: { swapInfo?: { label?: string } }[] };
        if (!res.ok || !body.outAmount) return null;
        const rawImpact = Math.abs(Number(body.priceImpactPct ?? 0));
        const impact = rawImpact > 1 ? rawImpact / 100 : rawImpact;
        const outDecimals = side === "sell" ? 6 : decimals;
        return {
          out: Number(body.outAmount),
          impact,
          ms: Date.now() - started,
          outUi: Number(body.outAmount) / 10 ** outDecimals,
          route: (body.routePlan ?? []).map((p) => p.swapInfo?.label).filter(Boolean).join(" → ") || (direct ? "direct" : "Jupiter"),
          direct,
        };
      } catch {
        return null;
      }
    }),
  );
  const ok = settled.filter((row): row is NonNullable<typeof row> => !!row && row.impact <= 0.05);
  if (!ok.length) throw new HarnessError(502, "Jupiter did not quote that name inside a 5% impact cap.");
  const read = readRoutes(ok.map((row) => ({ out: row.out, impact: row.impact, ms: row.ms })));
  const alive = ok.filter((_, i) => read.keep[i]);
  const started = Date.now();
  const ranked = scorePaths(alive.map((row, i) => ({ id: String(i), out: row.out, impact: row.impact, liquidity: 1 })));
  const ticket = receipt("scorePaths", started, alive.length);
  const pick = alive[Number(ranked[0]?.id ?? 0)] ?? alive[0];
  return { ...pick, rank: ranked[0]?.score ?? 0, rankMs: ticket.ms, coherence: read.coherence, cosine: read.cosine, logDistance: read.logDistance, resonance: read.resonance[ok.indexOf(pick)] ?? 0 };
}

type LiveToken = {
  id?: string;
  usdPrice?: number;
  liquidity?: number;
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number };
};

const moveCache = new Map<string, { at: number; price: number; change: number | null }>();

async function dayMove(mint: string): Promise<{ price: number; change: number | null }> {
  const hit = moveCache.get(mint);
  if (hit && Date.now() - hit.at < 30_000) return hit;
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, {
    headers: { accept: "application/json", "user-agent": "Senda" },
    signal: AbortSignal.timeout(12_000),
  });
  const body = (await res.json()) as LiveToken[];
  const row = (Array.isArray(body) ? body : []).find((item) => item.id === mint);
  const change = Number(row?.stats24h?.priceChange);
  const next = { at: Date.now(), price: Number(row?.usdPrice) || 0, change: Number.isFinite(change) ? change : null };
  moveCache.set(mint, next);
  return next;
}

async function discoverRows(limit: number) {
  const urls = [
    "https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=100",
    "https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=100",
  ];
  const pages = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda" }, signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return [] as LiveToken[];
        const body = (await res.json()) as unknown;
        return Array.isArray(body) ? (body as LiveToken[]) : [];
      } catch {
        return [] as LiveToken[];
      }
    }),
  );
  const byMint = new Map(agentNames().filter((row) => row.trade && row.mint).map((row) => [row.mint, row]));
  const seen = new Set<string>();
  const rows = [];
  for (const raw of pages.flat()) {
    if (!raw.id || seen.has(raw.id)) continue;
    const name = byMint.get(raw.id);
    if (!name) continue;
    seen.add(raw.id);
    const change = Number(raw.stats24h?.priceChange);
    rows.push({
      symbol: name.symbol,
      name: name.name,
      mint: name.mint,
      lane: name.lane,
      price: Number(raw.usdPrice) || 0,
      change: Number.isFinite(change) ? change : null,
      liquidity: Number(raw.liquidity) || 0,
      volume: (Number(raw.stats24h?.buyVolume) || 0) + (Number(raw.stats24h?.sellVolume) || 0),
      short: shortBook(name.symbol)?.label ?? null,
    });
  }
  const majors = ["SOL", "ETH", "BTC", "XRP", "JUP", "BONK", "WIF", "DOGE"];
  const missing = agentNames().filter((row) => row.trade && majors.includes(row.symbol) && !seen.has(row.mint));
  const extra = await Promise.all(missing.map(async (name) => ({ name, live: await dayMove(name.mint).catch(() => ({ price: 0, change: null as number | null })) })));
  for (const { name, live } of extra) {
    if (!(live.price > 0)) continue;
    rows.push({
      symbol: name.symbol,
      name: name.name,
      mint: name.mint,
      lane: name.lane,
      price: live.price,
      change: live.change,
      liquidity: 0,
      volume: 0,
      short: shortBook(name.symbol)?.label ?? null,
    });
  }
  rows.sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));
  return rows.slice(0, limit);
}

type RawLaunch = {
  id?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  launchpad?: string;
  holderCount?: number;
  createdAt?: string;
  organicScore?: number;
  liquidity?: number;
  usdPrice?: number;
  audit?: { mintAuthorityDisabled?: boolean; freezeAuthorityDisabled?: boolean; devMints?: number };
};

function asLaunch(raw: RawLaunch): Launch | null {
  if (!raw.id || !raw.symbol) return null;
  return {
    mint: raw.id,
    symbol: String(raw.symbol).toUpperCase().slice(0, 16),
    name: String(raw.name || raw.symbol).slice(0, 48),
    decimals: Number.isFinite(Number(raw.decimals)) ? Number(raw.decimals) : 6,
    launchpad: raw.launchpad || "unknown",
    holders: Number(raw.holderCount) || 0,
    createdAt: raw.createdAt || new Date().toISOString(),
    organic: Number(raw.organicScore) || 0,
    liquidity: Number(raw.liquidity) || 0,
    price: Number(raw.usdPrice) || 0,
    mintOff: raw.audit?.mintAuthorityDisabled === true,
    freezeOff: raw.audit?.freezeAuthorityDisabled === true,
    devMints: Number.isFinite(Number(raw.audit?.devMints)) ? Number(raw.audit?.devMints) : null,
  };
}

async function fetchLaunch(mint: string): Promise<Launch> {
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, {
    headers: { accept: "application/json", "user-agent": "Senda" },
    signal: AbortSignal.timeout(12_000),
  });
  const body = (await res.json()) as RawLaunch[];
  const row = asLaunch((Array.isArray(body) ? body : []).find((item) => item.id === mint) || {});
  if (!row) throw new HarnessError(404, "Jupiter does not list that mint.");
  return row;
}

async function recentLaunches(limit: number) {
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/recent?limit=${limit}`, {
    headers: { accept: "application/json", "user-agent": "Senda" },
    signal: AbortSignal.timeout(12_000),
  });
  const body = (await res.json()) as RawLaunch[];
  return (Array.isArray(body) ? body : []).map(asLaunch).filter((row): row is Launch => !!row).map((row) => {
    const scored = launchScore(row);
    return { ...row, score: scored.score, scoreMs: scored.ms, refused: scored.refused, fee: feeOn(1) };
  });
}

export async function harnessCall(method: string, token: string, params: Record<string, unknown>) {
  if (method === "open_harness") {
    const owner = typeof params.owner === "string" ? params.owner.slice(0, 64) : "";
    const sql = await getSql();
    const id = crypto.randomUUID();
    const bearer = `snd_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
    await sql.query("INSERT INTO agent_harness (id, token_hash, owner) VALUES ($1, $2, $3)", [id, await sha256(bearer), owner]);
    return {
      harnessId: id,
      token: bearer,
      note: "Copy this token once. An outside agent uses it as a bearer. It can queue a trade. It cannot sign, and it cannot see your wallet key.",
    };
  }

  const harness = await harnessId(token);
  const sql = await getSql();

  if (method === "list_names") {
    return { names: agentNames() };
  }

  if (method === "list_strategies") {
    const custom = await sql.query<{ id: string; name: string; category: string; thesis: string; rule_json: string; executable: boolean }>(
      "SELECT id, name, category, thesis, rule_json, executable FROM agent_strategy WHERE harness_id = $1 ORDER BY created_at DESC LIMIT 40",
      [harness],
    );
    const added: StrategyCard[] = custom.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      thesis: row.thesis,
      rule: parseRule(JSON.parse(row.rule_json)) ?? { kind: "note", side: "buy", symbols: [] },
      executable: Boolean(row.executable),
    }));
    return { strategies: [...SEED_STRATEGIES, ...added] };
  }

  if (method === "add_strategy") {
    const name = String(params.name || "").trim().slice(0, 60);
    const thesis = String(params.thesis || "").trim().slice(0, 800);
    const category = String(params.category || "custom").trim().slice(0, 32) || "custom";
    const rule = parseRule(params.rule);
    if (!name || !thesis || !rule) throw new HarnessError(400, "A strategy needs a name, a thesis, and a rule of kind clip, coherence, dip, momentum, or note.");
    const known = new Set(agentNames().map((row) => row.symbol));
    if (rule.symbols.some((symbol) => !known.has(symbol))) throw new HarnessError(400, "A symbol on that rule is not on the catalog.");
    const count = await sql.query<{ n: number }>("SELECT count(*)::int AS n FROM agent_strategy WHERE harness_id = $1", [harness]);
    if (Number(count[0]?.n || 0) >= 40) throw new HarnessError(400, "This harness already has 40 strategies.");
    const id = crypto.randomUUID();
    const executable = rule.kind !== "note";
    await sql.query(
      "INSERT INTO agent_strategy (id, harness_id, name, category, thesis, rule_json, executable) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [id, harness, name, category, thesis, JSON.stringify(rule), executable],
    );
    return { id, executable, note: executable ? "This rule can be used on a mission. A queued trade still waits for the wallet." : "Stored as research. A note does not trade." };
  }

  if (method === "open_mission") {
    const strategy = await strategyOf(String(params.strategyId || ""), harness);
    if (!strategy.executable) throw new HarnessError(400, "That strategy is research. It does not trade.");
    const bankroll = money(params.bankrollUsd);
    const aim = money(params.aimUsd);
    if (bankroll < 1 || bankroll > 5000) throw new HarnessError(400, "The bankroll has to be between $1 and $5,000.");
    if (aim < 0.5 || aim > bankroll) throw new HarnessError(400, "The daily aim has to be at least $0.50 and no larger than the bankroll.");
    const count = await sql.query<{ n: number }>("SELECT count(*)::int AS n FROM agent_mission WHERE harness_id = $1 AND status = 'open'", [harness]);
    if (Number(count[0]?.n || 0) >= 20) throw new HarnessError(400, "Twenty missions are already open.");
    const id = crypto.randomUUID();
    await sql.query(
      "INSERT INTO agent_mission (id, harness_id, strategy_id, bankroll_usd, aim_usd) VALUES ($1, $2, $3, $4, $5)",
      [id, harness, strategy.id, bankroll, aim],
    );
    return {
      id,
      strategyId: strategy.id,
      bankrollUsd: bankroll,
      aimUsd: aim,
      note: "The aim is the most that can be queued in a day. It is not a promised profit.",
    };
  }

  if (method === "list_missions") {
    const rows = await sql.query<MissionRow>(
      "SELECT id, strategy_id, bankroll_usd, aim_usd, spent_usd, day, day_spent, status FROM agent_mission WHERE harness_id = $1 ORDER BY created_at DESC LIMIT 20",
      [harness],
    );
    return {
      missions: rows.map((row) => ({
        id: row.id,
        strategyId: row.strategy_id,
        bankrollUsd: money(row.bankroll_usd),
        aimUsd: money(row.aim_usd),
        spentUsd: money(row.spent_usd),
        leftToday: clipLeft(
          { bankrollUsd: money(row.bankroll_usd), aimUsd: money(row.aim_usd), spentUsd: money(row.spent_usd), day: row.day, daySpent: money(row.day_spent) },
          today(),
        ),
        status: row.status,
      })),
    };
  }

  if (method === "quote" || method === "queue_trade") {
    const symbol = String(params.symbol || "").toUpperCase();
    const name = agentNames().find((row) => row.symbol === symbol);
    if (!name) throw new HarnessError(404, "That name is not on the catalog.");
    if (!name.trade) throw new HarnessError(400, `${symbol} is on the catalog and cannot be traded. ${name.symbol === "ICP" ? "There is no verified ICP mint on Solana." : ""}`.trim());
    const usd = money(params.usd);
    if (method === "quote") {
      if (usd < 0.5) throw new HarnessError(400, "Quote at least $0.50.");
      const quote = await quotePair(name.mint, usd, name.decimals, "buy");
      const liquidity = await poolUsd(name.mint);
      const thin = liquidity > 0 && usd > liquidity * 0.02;
      return { symbol, mint: name.mint, usd, out: quote.outUi, route: quote.route, impact: quote.impact, liquidity, thin, rank: quote.rank, coherence: quote.coherence, resonance: quote.resonance, signs: false, note: thin ? "This size is over 2% of the Jupiter pool. A queue of more than 5% is refused." : "A quote is not a fill. The rank only orders the two Jupiter lanes." };
    }
    const missionId = String(params.missionId || "");
    const missions = await sql.query<MissionRow>(
      "SELECT id, strategy_id, bankroll_usd, aim_usd, spent_usd, day, day_spent, status FROM agent_mission WHERE id = $1 AND harness_id = $2",
      [missionId, harness],
    );
    const mission = missions[0];
    if (!mission || mission.status !== "open") throw new HarnessError(404, "That mission is not open.");
    const strategy = await strategyOf(mission.strategy_id, harness);
    if (strategy.rule.symbols.length && !strategy.rule.symbols.includes(symbol)) throw new HarnessError(400, "That strategy does not include this name.");
    const left = clipLeft(
      { bankrollUsd: money(mission.bankroll_usd), aimUsd: money(mission.aim_usd), spentUsd: money(mission.spent_usd), day: mission.day, daySpent: money(mission.day_spent) },
      today(),
    );
    if (usd < 0.5 || usd > left) throw new HarnessError(400, left < 0.5 ? "Nothing left in today's aim." : `Today can still queue $${left.toFixed(2)}.`);
    if (strategy.rule.kind === "dip" || strategy.rule.kind === "momentum") {
      const live = await dayMove(name.mint);
      const change = live.change;
      if (change == null) throw new HarnessError(502, "No 24h change. Nothing was queued.");
      if (strategy.rule.kind === "dip" && !(change <= -2)) {
        throw new HarnessError(400, `${symbol} is ${change.toFixed(1)}% today. A dip strategy waits for -2% or worse.`);
      }
      if (strategy.rule.kind === "momentum" && !(change >= 2 && change <= 12)) {
        throw new HarnessError(400, `${symbol} is ${change.toFixed(1)}% today. Momentum waits for +2% to +12%.`);
      }
    }
    if (strategy.rule.kind !== "note") {
      const quote = await quotePair(name.mint, usd, name.decimals, strategy.rule.side);
      const liquidity = await poolUsd(name.mint);
      if (liquidity > 0 && usd > liquidity * 0.05) {
        throw new HarnessError(400, `${symbol} pool is about $${Math.round(liquidity).toLocaleString("en-US")}. $${usd.toFixed(2)} is over 5% of it. Nothing was queued.`);
      }
      if (quote.impact > 0.01) throw new HarnessError(400, `Price impact is ${(quote.impact * 100).toFixed(2)}%. Nothing was queued.`);
    }
    const day = today();
    const reserved = await sql.query<{ id: string }>(
      `UPDATE agent_mission
       SET spent_usd = spent_usd + $1,
           day = $2,
           day_spent = CASE WHEN day = $2 THEN day_spent + $1 ELSE $1 END
       WHERE id = $3 AND harness_id = $4 AND status = 'open'
         AND (bankroll_usd - spent_usd) >= $1
         AND (CASE WHEN day = $2 THEN aim_usd - day_spent ELSE aim_usd END) >= $1
       RETURNING id`,
      [usd, day, missionId, harness],
    );
    if (!reserved[0]) throw new HarnessError(400, "The mission could not reserve that size.");
    const id = crypto.randomUUID();
    const why = String(params.why || strategy.thesis).slice(0, 240);
    await sql.query(
      "INSERT INTO agent_intent (id, harness_id, mission_id, symbol, mint, side, usd, why) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [id, harness, missionId, symbol, name.mint, strategy.rule.side, usd, why],
    );
    return { id, symbol, mint: name.mint, side: strategy.rule.side, usd, status: "queued", signs: false, note: "Queued. The wallet has not signed. This is not a fill." };
  }

  if (method === "discover") {
    const limit = Math.min(20, Math.max(1, Math.round(Number(params.limit) || 8)));
    return { rows: await discoverRows(limit), note: "Live Jupiter names that are also on this catalog. A row is not a trade." };
  }

  if (method === "screen") {
    const limit = Math.min(40, Math.max(1, Math.round(Number(params.limit) || 15)));
    const q = String(params.q || "").trim().toLowerCase();
    const names = agentNames()
      .filter((row) => row.lane === "shares")
      .filter((row) => !q || `${row.symbol} ${row.name}`.toLowerCase().includes(q));
    return {
      count: names.length,
      names: names.slice(0, limit),
      note: "Backpack Securities on the catalog. quote, then queue_trade. This does not sign.",
    };
  }

  if (method === "short_book") {
    const symbol = String(params.symbol || "");
    const book = shortBook(symbol);
    return book
      ? { symbol: symbol.toUpperCase(), short: true, venue: book.label }
      : { symbol: symbol.toUpperCase(), short: false, venue: null, note: "No short market on that name. A token sale is not a short." };
  }

  if (method === "track") {
    const symbol = String(params.symbol || "").toUpperCase();
    const name = agentNames().find((row) => row.symbol === symbol);
    if (!name?.trade) throw new HarnessError(404, "That name is not tradable.");
    const thesis = String(params.thesis || "").trim().slice(0, 240);
    const count = await sql.query<{ n: number }>("SELECT count(*)::int AS n FROM agent_tracker WHERE harness_id = $1", [harness]);
    if (Number(count[0]?.n || 0) >= 24) throw new HarnessError(400, "Twenty-four names are already tracked.");
    const id = crypto.randomUUID();
    await sql.query(
      `INSERT INTO agent_tracker (id, harness_id, symbol, mint, thesis)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (harness_id, symbol) DO UPDATE SET thesis = EXCLUDED.thesis, mint = EXCLUDED.mint`,
      [id, harness, symbol, name.mint, thesis],
    );
    return { symbol, mint: name.mint, thesis };
  }

  if (method === "untrack") {
    const symbol = String(params.symbol || "").toUpperCase();
    await sql.query("DELETE FROM agent_tracker WHERE harness_id = $1 AND symbol = $2", [harness, symbol]);
    return { symbol, tracked: false };
  }

  if (method === "list_trackers") {
    const rows = await sql.query<{ symbol: string; mint: string; thesis: string }>(
      "SELECT symbol, mint, thesis FROM agent_tracker WHERE harness_id = $1 ORDER BY created_at DESC LIMIT 24",
      [harness],
    );
    const live = await Promise.all(rows.map(async (row) => {
      const tape = await dayMove(row.mint).catch(() => ({ price: 0, change: null as number | null }));
      return {
        symbol: row.symbol,
        mint: row.mint,
        thesis: row.thesis,
        price: tape.price,
        change: tape.change,
        short: shortBook(row.symbol)?.label ?? null,
      };
    }));
    return { trackers: live };
  }

  if (method === "check_coin") {
    const query = String(params.query || params.symbol || params.mint || "").trim().slice(0, 64);
    if (query.length < 2) throw new HarnessError(400, "Name the coin.");
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(query)}`, {
      headers: { accept: "application/json", "user-agent": "Senda" },
      signal: AbortSignal.timeout(12_000),
    });
    const body = (await res.json()) as RawLaunch[];
    const row = asLaunch((Array.isArray(body) ? body : []).find((item) => item.id === query || item.symbol?.toUpperCase() === query.toUpperCase()) || (Array.isArray(body) ? body[0] : {}) || {});
    if (!row) throw new HarnessError(404, "Jupiter does not list that coin.");
    const refused = refuseLaunch(row);
    const thin = row.liquidity > 0 && row.liquidity < 25_000;
    return {
      coin: row,
      refused,
      thin,
      signs: false,
      note: refused
        ? "Do not queue this. The refusal is the gate."
        : thin
          ? "Jupiter reports under $25,000 in the pool. A quote can still be asked. A queue over 5% of that pool is refused."
          : "Nothing was bought. A queue still waits for the person's wallet. Senda does not issue a coin.",
    };
  }

  if (method === "list_launches") {
    const limit = Math.min(30, Math.max(1, Math.round(Number(params.limit) || 12)));
    const rows = await recentLaunches(limit);
    return {
      launches: rows,
      feeBps: 10,
      feeCollected: false,
      note: "Jupiter's recent mints, including pump.fun when Jupiter marks that launchpad. A score is a similarity to a clean launch, not a promise. The 10 bps fee is shown and not collected.",
    };
  }

  if (method === "queue_launch") {
    const mint = String(params.mint || "");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) throw new HarnessError(400, "That mint is not a Solana address.");
    const launch = await fetchLaunch(mint);
    const blocked = refuseLaunch(launch);
    if (blocked) throw new HarnessError(400, blocked);
    const order = params.order === "limit" ? "limit" : "market";
    const limitPx = Number(params.limitPrice);
    if (order === "limit" && !(limitPx > 0)) throw new HarnessError(400, "A limit needs a price.");
    const usd = money(params.usd);
    const missionId = String(params.missionId || "");
    const missions = await sql.query<MissionRow>(
      "SELECT id, strategy_id, bankroll_usd, aim_usd, spent_usd, day, day_spent, status FROM agent_mission WHERE id = $1 AND harness_id = $2",
      [missionId, harness],
    );
    const mission = missions[0];
    if (!mission || mission.status !== "open") throw new HarnessError(404, "That mission is not open.");
    const left = clipLeft(
      { bankrollUsd: money(mission.bankroll_usd), aimUsd: money(mission.aim_usd), spentUsd: money(mission.spent_usd), day: mission.day, daySpent: money(mission.day_spent) },
      today(),
    );
    if (usd < 0.5 || usd > left) throw new HarnessError(400, left < 0.5 ? "Nothing left in today's aim." : `Today can still queue $${left.toFixed(2)}.`);
    if (order === "market") await quotePair(launch.mint, usd, launch.decimals, "buy");
    const day = today();
    const reserved = await sql.query<{ id: string }>(
      `UPDATE agent_mission
       SET spent_usd = spent_usd + $1,
           day = $2,
           day_spent = CASE WHEN day = $2 THEN day_spent + $1 ELSE $1 END
       WHERE id = $3 AND harness_id = $4 AND status = 'open'
         AND (bankroll_usd - spent_usd) >= $1
         AND (CASE WHEN day = $2 THEN aim_usd - day_spent ELSE aim_usd END) >= $1
       RETURNING id`,
      [usd, day, missionId, harness],
    );
    if (!reserved[0]) throw new HarnessError(400, "The mission could not reserve that size.");
    const id = crypto.randomUUID();
    const status = order === "limit" ? "resting" : "queued";
    const why = order === "limit"
      ? `limit=${limitPx}|${String(params.why || "Limit on a new mint.").slice(0, 160)}`
      : String(params.why || `${launch.launchpad}. Fee 10 bps shown, not collected.`).slice(0, 200);
    await sql.query(
      "INSERT INTO agent_intent (id, harness_id, mission_id, symbol, mint, side, usd, why, status) VALUES ($1, $2, $3, $4, $5, 'buy', $6, $7, $8)",
      [id, harness, missionId, launch.symbol, launch.mint, usd, why, status],
    );
    return { id, symbol: launch.symbol, mint: launch.mint, usd, status, fee: feeOn(usd), signs: false, note: status === "queued" ? "Queued. The wallet has not signed." : "Resting until the price is at or under the limit." };
  }

  if (method === "wake_limits") {
    const resting = await sql.query<{ id: string; mint: string; usd: number; why: string }>(
      "SELECT id, mint, usd, why FROM agent_intent WHERE harness_id = $1 AND status = 'resting' ORDER BY created_at ASC LIMIT 10",
      [harness],
    );
    const woken: string[] = [];
    for (const row of resting) {
      const match = /^limit=([0-9]*\.?[0-9]+)\|/.exec(row.why);
      if (!match) continue;
      const limitPx = Number(match[1]);
      const launch = await fetchLaunch(row.mint).catch(() => null);
      if (!launch || refuseLaunch(launch) || !(launch.price > 0) || launch.price > limitPx) continue;
      try {
        await quotePair(launch.mint, money(row.usd), launch.decimals, "buy");
      } catch {
        continue;
      }
      const updated = await sql.query<{ id: string }>(
        "UPDATE agent_intent SET status = 'queued' WHERE id = $1 AND harness_id = $2 AND status = 'resting' RETURNING id",
        [row.id, harness],
      );
      if (updated[0]) woken.push(row.id);
    }
    return { woken };
  }

  if (method === "market_matrix") {
    const symbol = String(params.symbol || "").toUpperCase();
    const name = agentNames().find((row) => row.symbol === symbol);
    if (!name?.mint) throw new HarnessError(404, "That name is not on the catalog.");
    const loaded = await poolMatrixBars(name.mint);
    const matrix = evaluateMatrix({ bars: loaded.bars, source: loaded.pool ? "gecko-pool" : "price-only" });
    return { symbol, mint: name.mint, matrix, signs: false, note: "The matrix does not sign and does not queue." };
  }

  if (method === "queue_matrix") {
    const symbol = String(params.symbol || "").toUpperCase();
    const name = agentNames().find((row) => row.symbol === symbol);
    if (!name?.trade) throw new HarnessError(400, "That name cannot be queued from the matrix.");
    const loaded = await poolMatrixBars(name.mint);
    const matrix = evaluateMatrix({ bars: loaded.bars, source: loaded.pool ? "gecko-pool" : "price-only" });
    if (!matrixClears(matrix)) throw new HarnessError(400, matrix.reason || "The matrix does not clear. Nothing was queued.");
    const usd = money(params.usd);
    const missionId = String(params.missionId || "");
    const missions = await sql.query<MissionRow>(
      "SELECT id, strategy_id, bankroll_usd, aim_usd, spent_usd, day, day_spent, status FROM agent_mission WHERE id = $1 AND harness_id = $2",
      [missionId, harness],
    );
    const mission = missions[0];
    if (!mission || mission.status !== "open") throw new HarnessError(404, "That mission is not open.");
    const left = clipLeft(
      { bankrollUsd: money(mission.bankroll_usd), aimUsd: money(mission.aim_usd), spentUsd: money(mission.spent_usd), day: mission.day, daySpent: money(mission.day_spent) },
      today(),
    );
    if (usd < 0.5 || usd > left) throw new HarnessError(400, left < 0.5 ? "Nothing left in today's aim." : `Today can still queue $${left.toFixed(2)}.`);
    await quotePair(name.mint, usd, name.decimals, "buy");
    const day = today();
    const reserved = await sql.query<{ id: string }>(
      `UPDATE agent_mission
       SET spent_usd = spent_usd + $1,
           day = $2,
           day_spent = CASE WHEN day = $2 THEN day_spent + $1 ELSE $1 END
       WHERE id = $3 AND harness_id = $4 AND status = 'open'
         AND (bankroll_usd - spent_usd) >= $1
         AND (CASE WHEN day = $2 THEN aim_usd - day_spent ELSE aim_usd END) >= $1
       RETURNING id`,
      [usd, day, missionId, harness],
    );
    if (!reserved[0]) throw new HarnessError(400, "The mission could not reserve that size.");
    const id = crypto.randomUUID();
    const why = `matrix|${matrix.market} ${matrix.confidence}`.slice(0, 200);
    await sql.query(
      "INSERT INTO agent_intent (id, harness_id, mission_id, symbol, mint, side, usd, why, status) VALUES ($1, $2, $3, $4, $5, 'buy', $6, $7, 'queued')",
      [id, harness, missionId, symbol, name.mint, usd, why],
    );
    return { id, symbol, usd, status: "queued", market: matrix.market, confidence: matrix.confidence, signs: false, note: "Queued for you to sign. Pro will not open the wallet for a matrix buy." };
  }

  if (method === "list_intents") {
    const rows = await sql.query<{ id: string; mission_id: string; symbol: string; mint: string; side: string; usd: number; why: string; status: string; signature: string; created_at: string | Date }>(
      "SELECT id, mission_id, symbol, mint, side, usd, why, status, signature, created_at FROM agent_intent WHERE harness_id = $1 ORDER BY created_at ASC LIMIT 30",
      [harness],
    );
    return {
      intents: rows.map((row) => ({
        ...row,
        usd: money(row.usd),
        at: new Date(row.created_at).toISOString(),
      })),
    };
  }

  if (method === "mark_signed") {
    const id = String(params.id || "");
    const signature = String(params.signature || "").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(signature)) throw new HarnessError(400, "That is not a signature.");
    const rows = await sql.query<{ id: string }>(
      "UPDATE agent_intent SET status = 'signed', signature = $1 WHERE id = $2 AND harness_id = $3 AND status = 'queued' RETURNING id",
      [signature, id, harness],
    );
    if (!rows[0]) throw new HarnessError(404, "That intent is not waiting for a signature.");
    return { id, status: "signed" };
  }

  if (method === "release") {
    const id = String(params.id || "");
    const rows = await sql.query<{ id: string; mission_id: string; usd: number }>(
      "UPDATE agent_intent SET status = 'released' WHERE id = $1 AND harness_id = $2 AND status IN ('queued', 'resting') RETURNING id, mission_id, usd",
      [id, harness],
    );
    const row = rows[0];
    if (!row) throw new HarnessError(404, "That intent is not queued.");
    const day = today();
    await sql.query(
      `UPDATE agent_mission
       SET spent_usd = GREATEST(0, spent_usd - $1),
           day_spent = CASE WHEN day = $2 THEN GREATEST(0, day_spent - $1) ELSE day_spent END
       WHERE id = $3 AND harness_id = $4`,
      [money(row.usd), day, row.mission_id, harness],
    );
    return { id, status: "released" };
  }

  throw new HarnessError(404, "That harness call does not exist.");
}

export const MCP_TOOLS = [
  { name: "list_names", description: "Every name the desk will show an agent, including ones that cannot be traded.", inputSchema: { type: "object", properties: {} } },
  { name: "list_strategies", description: "Seed strategies plus strategies this harness added.", inputSchema: { type: "object", properties: {} } },
  { name: "add_strategy", description: "Add a strategy. kind is clip, coherence, dip, momentum, or note. A note is research and does not trade. Dip buys only after a -2% day. Momentum buys only between +2% and +12%.", inputSchema: { type: "object", properties: { name: { type: "string" }, category: { type: "string" }, thesis: { type: "string" }, rule: { type: "object" } }, required: ["name", "thesis", "rule"] } },
  { name: "screen", description: "Backpack Securities the catalog will trade. Filter with q. Does not sign.", inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "number" } } } },
  { name: "short_book", description: "Whether a name has a real short market. A token sale is not a short.", inputSchema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } },
  { name: "track", description: "Put a catalog name on this harness tracker with a short thesis.", inputSchema: { type: "object", properties: { symbol: { type: "string" }, thesis: { type: "string" } }, required: ["symbol"] } },
  { name: "untrack", description: "Remove a name from the tracker.", inputSchema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } },
  { name: "list_trackers", description: "Tracked names with a live price, 24h change, and short venue.", inputSchema: { type: "object", properties: {} } },
  { name: "open_mission", description: "Open a bankroll and a daily aim on an executable strategy. The aim is risk for the day, not promised profit.", inputSchema: { type: "object", properties: { strategyId: { type: "string" }, bankrollUsd: { type: "number" }, aimUsd: { type: "number" } }, required: ["strategyId", "bankrollUsd", "aimUsd"] } },
  { name: "quote", description: "Quote a catalog name in USDC. Does not sign.", inputSchema: { type: "object", properties: { symbol: { type: "string" }, usd: { type: "number" } }, required: ["symbol", "usd"] } },
  { name: "queue_trade", description: "Reserve today's aim and queue a trade. Does not sign and does not fill.", inputSchema: { type: "object", properties: { missionId: { type: "string" }, symbol: { type: "string" }, usd: { type: "number" }, why: { type: "string" } }, required: ["missionId", "symbol", "usd"] } },
  { name: "list_missions", description: "Open missions and what is left today.", inputSchema: { type: "object", properties: {} } },
  { name: "list_intents", description: "Queued, resting, signed, and released trades for this harness.", inputSchema: { type: "object", properties: {} } },
  { name: "check_coin", description: "Look up one Solana coin on Jupiter before anyone buys. Returns holders, liquidity, mint authority, freeze authority, and a rug refusal when one applies. Does not trade and does not create a wallet.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "queue_launch", description: "Queue a buy of a new mint after the rug gates. order is market or limit. A market order must quote. A limit rests. Does not sign. Fee is 10 bps shown and not collected.", inputSchema: { type: "object", properties: { missionId: { type: "string" }, mint: { type: "string" }, usd: { type: "number" }, order: { type: "string" }, limitPrice: { type: "number" }, why: { type: "string" } }, required: ["missionId", "mint", "usd"] } },
  { name: "wake_limits", description: "Move a resting limit to the sign queue once the live price is at or under the limit and the rug gates still pass.", inputSchema: { type: "object", properties: {} } },
  { name: "market_matrix", description: "Score a catalog name from real Solana pool candles. Volume signals stay off when the pool volume is missing. Does not trade.", inputSchema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } },
  { name: "queue_matrix", description: "Queue a buy only when pool volume is real, the matrix is a bullish watch, and ATR is at most 8% of price. Does not sign. Pro will not auto-open the wallet.", inputSchema: { type: "object", properties: { missionId: { type: "string" }, symbol: { type: "string" }, usd: { type: "number" } }, required: ["missionId", "symbol", "usd"] } },
] as const;
