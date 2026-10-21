/** App-wide dollars signed through Senda. Not a user's balance. */

import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

export type MoveTotal = {
  usd: number;
  count: number;
  swaps: number;
  sends: number;
};

function dollarsIn(title: string, detail: string): number {
  const found = `${title} ${detail}`.match(/\$(\d{1,7}(?:\.\d{1,2})?)/);
  if (!found) return 0;
  const n = Number(found[1]);
  return n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : 0;
}

export function dollarsOf(title: string, detail: string, usd?: number): number {
  if (usd != null && usd > 0 && usd < 1_000_000) return Math.round(usd * 100) / 100;
  return dollarsIn(title, detail);
}

type Staged = { usd: number; kind: "swap" | "send"; title: string };
let staged: Staged | null = null;

/** Call this in the same turn as the signature, before the wallet is asked. */
export function stageMove(row: Staged) {
  staged = { ...row, usd: row.usd > 0 && row.usd < 1_000_000 ? Math.round(row.usd * 100) / 100 : 0 };
}

export function clearMove() {
  staged = null;
}
export function sealMove(signature: string, force = false) {
  const row = staged;
  if (!row && !force) return;
  staged = null;
  const sig = signature.trim();
  if (sig.length < 4) return;
  void recordMove({
    data: {
      signature: sig.slice(0, 120),
      kind: row?.kind ?? "swap",
      title: row?.title ?? "Signed",
      usd: row?.usd ?? 0,
    },
  }).catch(() => undefined);
}

export const recordMove = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = (input ?? {}) as { signature?: string; kind?: string; title?: string; usd?: number };
    const signature = String(body.signature ?? "").trim().slice(0, 120);
    const usd = Number(body.usd);
    if (signature.length < 4) throw new Error("No signature.");
    if (!(usd >= 0) || usd >= 1_000_000) throw new Error("No dollars.");
    const kind = body.kind === "send" ? "send" : "swap";
    return { signature, kind, title: String(body.title ?? "").slice(0, 140), usd: Math.round(usd * 100) / 100 };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into move (signature, kind, title, usd)
      values (${data.signature}, ${data.kind}, ${data.title}, ${data.usd})
      on conflict (signature) do update set
        usd = case when move.usd = 0 and excluded.usd > 0 then excluded.usd else move.usd end,
        kind = case when move.usd = 0 and excluded.usd > 0 then excluded.kind else move.kind end,
        title = case when move.usd = 0 and excluded.usd > 0 then excluded.title else move.title end
    `;
    return { ok: true as const };
  });

export const movedThrough = createServerFn({ method: "GET" }).handler(async (): Promise<MoveTotal> => {
  const sql = await getSql();
  const rows = await sql<{ kind: string; n: string; usd: string }>`
    select kind, count(*)::text as n, coalesce(sum(usd), 0)::text as usd
    from move
    group by kind
  `;
  let usd = 0;
  let count = 0;
  let swaps = 0;
  let sends = 0;
  for (const row of rows) {
    const n = Number(row.n) || 0;
    const dollars = Number(row.usd) || 0;
    usd += dollars;
    count += n;
    if (row.kind === "send") sends += dollars;
    else swaps += dollars;
  }
  return {
    usd: Math.round(usd * 100) / 100,
    count,
    swaps: Math.round(swaps * 100) / 100,
    sends: Math.round(sends * 100) / 100,
  };
});
