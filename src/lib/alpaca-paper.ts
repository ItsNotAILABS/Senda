/** Alpaca paper only. The live host is not in this file. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { brokerageSymbol } from "@/lib/xstock-law";

const PAPER = "https://paper-api.alpaca.markets";

function keys() {
  const id = process.env.ALPACA_KEY_ID;
  const secret = process.env.ALPACA_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

function headers(id: string, secret: string) {
  return { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret, accept: "application/json" };
}

export const alpacaPaperStatus = createServerFn({ method: "GET" }).handler(async () => {
  const auth = keys();
  if (!auth) {
    return { ok: false as const, reason: "No Alpaca paper keys on this server. No order was sent. This is not a live share account." };
  }
  const res = await fetch(`${PAPER}/v2/account`, { headers: headers(auth.id, auth.secret), signal: AbortSignal.timeout(8000) });
  if (!res.ok) return { ok: false as const, reason: `Alpaca paper refused the account (${res.status}). No order was sent.` };
  const json = (await res.json()) as { status?: string; buying_power?: string; account_number?: string };
  return {
    ok: true as const,
    reason: `Paper account ${json.status || "open"}. Buying power ${json.buying_power || "—"}. This is paper, not a live share.`,
  };
});

/** A $5 market day-order on the paper book. Refuses an xStock ticker before the request. */
export const alpacaPaperBuy = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ symbol: z.string().min(1).max(12) }).parse(input))
  .handler(async ({ data }) => {
    const gate = brokerageSymbol(data.symbol);
    if (!gate.ok) return { ok: false as const, reason: gate.reason };
    const auth = keys();
    if (!auth) return { ok: false as const, reason: "No Alpaca paper keys. The $5 order was not sent." };
    const res = await fetch(`${PAPER}/v2/orders`, {
      method: "POST",
      headers: { ...headers(auth.id, auth.secret), "content-type": "application/json" },
      body: JSON.stringify({
        symbol: gate.symbol,
        notional: "5",
        side: "buy",
        type: "market",
        time_in_force: "day",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false as const, reason: `Alpaca paper did not take ${gate.symbol} (${res.status}). ${text.slice(0, 180)}` };
    }
    const json = (await res.json()) as { id?: string; status?: string; symbol?: string };
    return {
      ok: true as const,
      reason: `Paper order ${json.id || "accepted"} for ${json.symbol || gate.symbol} is ${json.status || "open"}. It is not a live fill, and it is not AAPLx.`,
    };
  });
