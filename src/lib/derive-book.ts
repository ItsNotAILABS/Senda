import { createServerFn } from "@tanstack/react-start";

export type OutsideContract = {
  venue: "derive";
  name: string;
  symbol: string;
  kind: "call" | "put";
  strike: number;
  expiry: number;
  index: number;
  mark: number;
  bid: number;
  ask: number;
  openInterest: number;
};

type Tick = {
  I?: string;
  M?: string;
  b?: string;
  a?: string;
  option_pricing?: { i?: string };
  stats?: { oi?: string };
};

async function derive(path: string, body: unknown): Promise<unknown> {
  const r = await fetch(`https://api.derive.xyz/v3/public/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Senda" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Derive ${r.status}`);
  const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message || "Derive");
  return j.result;
}

function parts(name: string): { symbol: string; day: string; strike: number; kind: "call" | "put" } | null {
  const m = name.match(/^([A-Z]+)-(\d{8})-([0-9_]+)-([CP])$/);
  if (!m) return null;
  return { symbol: m[1], day: m[2], strike: Number(m[3].replace("_", ".")), kind: m[4] === "C" ? "call" : "put" };
}

async function one(name: string, kind: "call" | "put", symbol: string, strike: number): Promise<OutsideContract | null> {
  const inst = (await derive("get_instrument", { instrument_name: name })) as { option_details?: { expiry?: number } };
  const tick = (await derive("get_ticker", { instrument_name: name })) as Tick;
  const expiry = Number(inst?.option_details?.expiry || 0) * 1000;
  const index = Number(tick?.I || 0);
  const mark = Number(tick?.M || 0);
  if (!(expiry > 0) || !(strike > 0)) return null;
  return {
    venue: "derive",
    name,
    symbol,
    kind,
    strike,
    expiry,
    index,
    mark,
    bid: Number(tick?.b || 0),
    ask: Number(tick?.a || 0),
    openInterest: Number(tick?.stats?.oi || 0),
  };
}

export async function fetchOutsideBook(): Promise<OutsideContract[]> {
  const names = (await derive("get_all_live_instruments", {
    expired: false,
    instrument_type: "option",
    currency: null,
    page: 1,
    page_size: 20,
  })) as string[];
  const parsed = names.map((n) => ({ n, p: parts(n) })).filter((x) => x.p && (x.p.symbol === "ETH" || x.p.symbol === "SOL"));
  const out: OutsideContract[] = [];
  for (const symbol of ["ETH", "SOL"] as const) {
    const rows = parsed.filter((x) => x.p!.symbol === symbol);
    const day = rows.map((x) => x.p!.day).sort()[0];
    if (!day) continue;
    const book = rows.filter((x) => x.p!.day === day);
    const probe = book.find((x) => x.p!.kind === "call") || book[0];
    const tick = (await derive("get_ticker", { instrument_name: probe.n }).catch(() => null)) as Tick | null;
    const index = Number(tick?.I || 0);
    const nearest = (kind: "call" | "put") => {
      const side = book.filter((x) => x.p!.kind === kind);
      if (!side.length) return null;
      if (!(index > 0)) return side[0];
      return side.sort((a, b) => Math.abs(a.p!.strike - index) - Math.abs(b.p!.strike - index))[0];
    };
    for (const kind of ["call", "put"] as const) {
      const row = nearest(kind);
      if (!row) continue;
      const card = await one(row.n, kind, symbol, row.p!.strike).catch(() => null);
      if (card) out.push(card);
    }
  }
  return out;
}

export const getOutsideBook = createServerFn({ method: "GET" }).handler(async () => fetchOutsideBook());
