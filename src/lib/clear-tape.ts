/**
 * Client blotter of signatures this browser has seen.
 * Not a balance. A fresh browser is empty.
 */

import { confirmSig } from "@/lib/money-move";

const KEY = "senda.clear.v1";
const CAP = 40;

export type ClearRecord = {
  sig: string;
  from: string;
  to: string;
  usd: number;
  memo: string;
  at: number;
  status: "confirmed" | "pending" | "failed";
  kind: "send" | "predict" | "work" | "cover" | "buy";
};

const KINDS = new Set<ClearRecord["kind"]>(["send", "predict", "work", "cover", "buy"]);
const STATUSES = new Set<ClearRecord["status"]>(["confirmed", "pending", "failed"]);

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function cents(usd: number): number {
  return Math.round(usd * 100) / 100;
}

function readRaw(): ClearRecord[] {
  const ls = store();
  if (!ls) return [];
  try {
    const raw = JSON.parse(ls.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    const rows: ClearRecord[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const r = item as Partial<ClearRecord>;
      if (typeof r.sig !== "string" || !r.sig) continue;
      if (typeof r.from !== "string" || typeof r.to !== "string") continue;
      if (typeof r.kind !== "string" || !KINDS.has(r.kind as ClearRecord["kind"])) continue;
      if (typeof r.status !== "string" || !STATUSES.has(r.status as ClearRecord["status"])) continue;
      const usd = Number(r.usd);
      if (!Number.isFinite(usd)) continue;
      rows.push({
        sig: r.sig,
        from: r.from,
        to: r.to,
        usd: cents(usd),
        memo: typeof r.memo === "string" ? r.memo : "",
        at: typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0,
        status: r.status as ClearRecord["status"],
        kind: r.kind as ClearRecord["kind"],
      });
    }
    rows.sort((a, b) => b.at - a.at);
    return rows.slice(0, CAP);
  } catch {
    return [];
  }
}

function write(rows: ClearRecord[]): ClearRecord[] {
  const next = [...rows].sort((a, b) => b.at - a.at).slice(0, CAP);
  const ls = store();
  if (!ls) return [];
  try {
    ls.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota — the caller still sees the list */
  }
  return next;
}

export function listClears(): ClearRecord[] {
  return readRaw();
}

/** Same signature updates in place. A new one is prepended. Forty, newest first. */
export function rememberClear(
  row: Omit<ClearRecord, "at" | "status"> & { status?: ClearRecord["status"] },
): ClearRecord[] {
  if (typeof window === "undefined") return [];
  if (typeof row.sig !== "string" || !row.sig) return listClears();
  if (!Number.isFinite(row.usd)) return listClears();
  if (!KINDS.has(row.kind)) return listClears();
  const prev = listClears();
  const hit = prev.find((r) => r.sig === row.sig);
  const status = row.status ?? hit?.status ?? "pending";
  const nextRow: ClearRecord = {
    sig: row.sig,
    from: row.from,
    to: row.to,
    usd: cents(row.usd),
    memo: row.memo,
    at: hit?.at ?? Date.now(),
    status,
    kind: row.kind,
  };
  const rest = prev.filter((r) => r.sig !== row.sig);
  return write([nextRow, ...rest]);
}

/** Ask the chain about anything still pending. An RPC outage leaves that row pending. */
export async function refreshClears(): Promise<ClearRecord[]> {
  const start = listClears();
  if (start.length === 0) return start;
  const updates = new Map<string, ClearRecord["status"]>();
  for (const row of start) {
    if (row.status !== "pending") continue;
    try {
      const status = await confirmSig(row.sig);
      if (status !== row.status) updates.set(row.sig, status);
    } catch {
      /* both RPCs failed — do not invent a failure */
    }
  }
  if (updates.size === 0) return listClears();
  const now = listClears();
  let dirty = false;
  for (const row of now) {
    const status = updates.get(row.sig);
    if (status && row.status === "pending") {
      row.status = status;
      dirty = true;
    }
  }
  return dirty ? write(now) : now;
}
