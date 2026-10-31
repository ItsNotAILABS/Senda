/** DriveWealth brokerage. Cashless is the only model that does not invent a Senda cash balance. */

import { createServerFn } from "@tanstack/react-start";

const HOST = "https://bo-api.drivewealth.io";

export const DW_MODELS = [
  {
    id: "individual",
    name: "Individual",
    hold: "The customer links a bank to a DriveWealth account and moves their own cash. DriveWealth holds it.",
    fit: "Not this desk. That is a second balance.",
  },
  {
    id: "bulk",
    name: "Bulk",
    hold: "The client holds the cash and tells DriveWealth about each deposit. One net wire settles at T+1.",
    fit: "Not this desk. Senda does not hold customer cash.",
  },
  {
    id: "cashless",
    name: "Cashless",
    hold: "No deposit step. The customer never sees a brokerage balance. DriveWealth nets the trades at T+1. A Travel Rule bank account has to exist before the brokerage account.",
    fit: "This is the model. Buying power is the wallet. An order is not a Jupiter swap.",
  },
  {
    id: "omnibus",
    name: "Omnibus",
    hold: "One master account. The client keeps every customer’s positions, cash, tax docs, and market data. Every order needs a stable client ID.",
    fit: "Not this desk. That makes Senda the broker of record.",
  },
] as const;

export const dwStatus = createServerFn({ method: "GET" }).handler(async () => {
  const clientID = process.env.DW_CLIENT_ID;
  const clientSecret = process.env.DW_CLIENT_SECRET;
  const appKey = process.env.DW_APP_KEY;
  if (!clientID || !clientSecret || !appKey) {
    return {
      live: false,
      model: "cashless" as const,
      reason: "No DriveWealth keys on this server. No session is opened, and no order is sent.",
    };
  }
  const res = await fetch(`${HOST}/back-office/auth/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json", "dw-client-app-key": appKey },
    body: JSON.stringify({ clientID, clientSecret }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    return {
      live: false,
      model: "cashless" as const,
      reason: `DriveWealth refused the session (${res.status}). Nothing was ordered.`,
    };
  }
  const json = (await res.json()) as { scope?: string; expires_in?: string };
  return {
    live: true,
    model: "cashless" as const,
    reason: `Session accepted${json.scope ? `, scope ${json.scope}` : ""}. This screen still does not place an order.`,
  };
});
