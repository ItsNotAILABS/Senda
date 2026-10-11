/** Live peso quote. Not a fill. Senda does not sell MXN. */

import { createServerFn } from "@tanstack/react-start";

export type MxnDesk = {
  /** Frankfurter blended USD/MXN. The estimate we divide by. */
  market: number | null;
  marketDate: string | null;
  /** Banxico FIX, republished by Frankfurter. Official, not a trading rate. */
  fix: number | null;
  fixDate: string | null;
  /** Bitso usd_mxn last. Their dollar book, not a USDC sale. */
  bitso: number | null;
  bitsoAt: string | null;
};

const MARKET = "https://api.frankfurter.dev/v2/rate/usd/mxn";
const FIX = "https://api.frankfurter.dev/v2/providers/banxico/rates?base=USD&quotes=MXN";
const BITSO = "https://api.bitso.com/v3/ticker/?book=usd_mxn";

let cache: { at: number; desk: MxnDesk } | null = null;

async function pull(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function pairRate(body: unknown): { rate: number; date: string | null } | null {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object") return null;
  const rec = row as { rate?: number; rates?: { MXN?: number }; date?: string };
  const n = Number(rec.rate ?? rec.rates?.MXN);
  if (!(n > 0)) return null;
  return { rate: n, date: rec.date ?? null };
}

export async function loadMxnDesk(): Promise<MxnDesk> {
  if (cache && Date.now() - cache.at < 60_000) return cache.desk;
  const desk: MxnDesk = { market: null, marketDate: null, fix: null, fixDate: null, bitso: null, bitsoAt: null };
  await Promise.all([
    pull(MARKET)
      .then((j) => {
        const row = pairRate(j);
        if (!row) return;
        desk.market = row.rate;
        desk.marketDate = row.date;
      })
      .catch(() => undefined),
    pull(FIX)
      .then((j) => {
        const row = pairRate(j);
        if (!row) return;
        desk.fix = row.rate;
        desk.fixDate = row.date;
      })
      .catch(() => undefined),
    pull(BITSO)
      .then((j) => {
        const row = j as { payload?: { last?: string; created_at?: string } };
        const last = Number(row.payload?.last);
        if (!(last > 0)) return;
        desk.bitso = last;
        desk.bitsoAt = row.payload?.created_at ?? null;
      })
      .catch(() => undefined),
  ]);
  cache = { at: Date.now(), desk };
  return desk;
}

export const getMxnDesk = createServerFn({ method: "GET" }).handler(async (): Promise<MxnDesk> => loadMxnDesk());
