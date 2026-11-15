/**
 * Kalshi link check and order. The PEM is signed for this request only.
 * The server does not keep the key. An order is sent only when this desk asks.
 */

import { constants, createPrivateKey, sign as nodeSign } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UA = "Senda/1.0";
const HOSTS = [
  "https://external-api.kalshi.com/trade-api/v2",
  "https://api.elections.kalshi.com/trade-api/v2",
];
const BALANCE_PATH = "/trade-api/v2/portfolio/balance";
const ORDER_PATH = "/trade-api/v2/portfolio/events/orders";

const inputSchema = z.object({
  keyId: z.string().min(8).max(80),
  pem: z.string().min(80).max(12_000),
});

export type KalshiCheck =
  | { ok: true; balance: number | null; host: string }
  | { ok: false; error: string };

function n(v: unknown): number | null {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function signRequest(pem: string, timestamp: string, method: string, path: string): string {
  const key = createPrivateKey(pem);
  const payload = Buffer.from(`${timestamp}${method}${path}`);
  const sig = nodeSign("sha256", payload, {
    key,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32,
  });
  return sig.toString("base64");
}

async function getBalance(host: string, keyId: string, pem: string): Promise<{ status: number; balance: number | null; detail: string }> {
  const timestamp = String(Date.now());
  const signature = signRequest(pem, timestamp, "GET", BALANCE_PATH);
  const res = await fetch(`${host}/portfolio/balance`, {
    headers: {
      accept: "application/json",
      "user-agent": UA,
      "KALSHI-ACCESS-KEY": keyId,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
      "KALSHI-ACCESS-SIGNATURE": signature,
    },
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }
  const balance =
    n(json.balance) ??
    n(json.balance_dollars) ??
    n(json.cash_balance_dollars) ??
    n((json.balance as Record<string, unknown> | undefined)?.balance) ??
    null;
  return { status: res.status, balance, detail: String(json.message ?? json.error ?? text).slice(0, 180) };
}

export const checkKalshiLink = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<KalshiCheck> => {
    const pem = data.pem.trim();
    if (!/PRIVATE KEY/.test(pem)) {
      return { ok: false, error: "That file is not an RSA private key. Paste the PEM Kalshi downloaded." };
    }
    const keyId = data.keyId.trim();
    try {
      createPrivateKey(pem);
    } catch {
      return { ok: false, error: "Could not read that private key. Use the .key / PEM Kalshi showed once." };
    }

    let last = "Kalshi rejected the key.";
    for (const host of HOSTS) {
      try {
        const r = await getBalance(host, keyId, pem);
        if (r.status === 200) {
          return { ok: true, balance: r.balance, host };
        }
        if (r.status === 401 || r.status === 403) {
          last = "Key ID or signature was rejected. Check the Key ID and that this is the matching PEM.";
          continue;
        }
        last = r.detail || `Kalshi ${r.status}`;
      } catch (err) {
        last = err instanceof Error ? err.message : "Could not reach Kalshi.";
      }
    }
    return { ok: false, error: last };
  });

const orderSchema = z.object({
  keyId: z.string().min(8).max(80),
  pem: z.string().min(80).max(12_000),
  ticker: z.string().min(2).max(80),
  side: z.enum(["yes", "no"]),
  count: z.number().int().min(1).max(5_000),
  cents: z.number().int().min(1).max(99),
});

export type KalshiOrder =
  | { ok: true; id: string; status: string; filled: number }
  | { ok: false; error: string };

/** Buys YES as a bid, or NO as the matching ask, on Kalshi's current order route. Immediate or cancel. A miss does not rest. */
export const placeKalshiOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data }): Promise<KalshiOrder> => {
    const pem = data.pem.trim();
    if (!/PRIVATE KEY/.test(pem)) return { ok: false, error: "That file is not an RSA private key." };
    const yesCents = data.side === "yes" ? data.cents : 100 - data.cents;
    if (yesCents < 1 || yesCents > 99) return { ok: false, error: "That price is not between 1¢ and 99¢." };
    const body = {
      ticker: data.ticker.trim(),
      side: data.side === "yes" ? "bid" : "ask",
      count: String(data.count),
      price: (yesCents / 100).toFixed(4),
      time_in_force: "immediate_or_cancel",
      self_trade_prevention_type: "taker_at_cross",
      client_order_id: crypto.randomUUID(),
    };
    const raw = JSON.stringify(body);
    let last = "Kalshi did not take the order.";
    for (const host of HOSTS) {
      try {
        const timestamp = String(Date.now());
        const signature = signRequest(pem, timestamp, "POST", ORDER_PATH);
        const res = await fetch(`${host}/portfolio/events/orders`, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "user-agent": UA,
            "KALSHI-ACCESS-KEY": data.keyId.trim(),
            "KALSHI-ACCESS-TIMESTAMP": timestamp,
            "KALSHI-ACCESS-SIGNATURE": signature,
          },
          body: raw,
        });
        const text = await res.text();
        let json: Record<string, unknown> = {};
        try {
          json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          json = {};
        }
        const order = (json.order && typeof json.order === "object" ? json.order : json) as Record<string, unknown>;
        if (res.ok) {
          const filled = Number(order.fill_count_fp ?? order.fill_count ?? 0) || 0;
          return {
            ok: true,
            id: String(order.order_id ?? "").slice(0, 36),
            status: String(order.status ?? (filled > 0 ? "executed" : "canceled")),
            filled,
          };
        }
        if (res.status === 410) {
          last = "Kalshi retired that order route. Nothing was sent on the old one.";
          continue;
        }
        last = String(json.message ?? json.error ?? text).slice(0, 180) || `Kalshi ${res.status}`;
        if (res.status === 401 || res.status === 403) last = "The Kalshi key was rejected. Check it under Accounts.";
      } catch (err) {
        last = err instanceof Error ? err.message : "Could not reach Kalshi.";
      }
    }
    return { ok: false, error: last };
  });

