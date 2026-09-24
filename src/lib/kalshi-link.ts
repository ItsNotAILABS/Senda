/**
 * Kalshi link check — signs with the user's PEM for this request only.
 * The private key is not stored. Live order placement is not armed.
 */

import { constants, createPrivateKey, sign as nodeSign } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UA = "ThePIT/1.0 (paper prediction pit; venue link check; no order routing)";
const HOSTS = [
  "https://external-api.kalshi.com/trade-api/v2",
  "https://api.elections.kalshi.com/trade-api/v2",
];
const PATH = "/trade-api/v2/portfolio/balance";

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
  const signature = signRequest(pem, timestamp, "GET", PATH);
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
