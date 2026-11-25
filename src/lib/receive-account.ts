/**
 * A dollar account is not invented here.
 * Bridge opens a Lead Bank virtual account in the customer's name.
 * Incoming ACH and wires are converted to USDC and sent to the Solana address.
 * Rain is the Visa principal member that can issue the card against that USDC.
 * Neither call runs unless the program key is on the server.
 */

import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { bridgeUserError, createSqlNonceStore, fetchWithTimeout, verifyReceiveAuthorization } from "@/lib/receive-account-auth.mjs";

const BRIDGE = "https://api.bridge.xyz/v0";

export type IssuedAccount = {
  ok: true;
  currency: "usd" | "eur" | "mxn";
  beneficiary: string;
  account: string;
  routing: string;
  wire: string;
  iban: string;
  bic: string;
  bank: string;
  address: string;
};

type BridgeInstructions = {
  bank_beneficiary_name?: string;
  account_holder_name?: string;
  bank_account_number?: string;
  bank_routing_number?: string;
  iban?: string;
  bic?: string;
  clabe?: string;
  bank_name?: string;
  bank_address?: string;
};

export const openReceiveAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        wallet: z.string().min(32).max(48),
        currency: z.enum(["usd", "eur", "mxn"]),
        signedAt: z.number().int().positive(),
        nonce: z.string().regex(/^[a-f0-9]{32}$/),
        signature: z.string().min(84).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data,context }): Promise<IssuedAccount | { ok: false; error: string }> => {
    let owner: string;
    try {
      owner = new PublicKey(data.wallet).toBase58();
    } catch {
      return { ok: false, error: "That is not a Solana address." };
    }
    // A single configured Bridge customer belongs to exactly one verified Senda user.
    // Never allow arbitrary signed-in users to open accounts against the same KYC identity.
    const authorizedUser = process.env.BRIDGE_ALLOWED_USER_ID?.trim();
    if(context.userId==="dev-user"||!authorizedUser||authorizedUser!==context.userId) {
      return {ok:false,error:"Bank account provisioning is not available to this verified customer."};
    }
    if(process.env.SENDA_BRIDGE_RECEIVE_ENABLED!=="true")
      return {ok:false,error:"Bank provisioning has not been activated for this account."};
    let nonceStore;
    try {
      const sql = await getSql();
      nonceStore = createSqlNonceStore((text, params) => sql.query(text, params));
    } catch (e) {
      console.error("[receive-account] nonce store unavailable", e instanceof Error ? e.message : e);
      return { ok: false, error: "Wallet authorization cannot be checked right now." };
    }
    const auth = await verifyReceiveAuthorization({
      owner,
      ownerKeyBytes: new PublicKey(owner).toBytes(),
      currency: data.currency,
      signedAt: data.signedAt,
      nonce: data.nonce,
      signature: data.signature,
      userId: context.userId,
      nonceStore,
    });
    if (!auth.ok) return { ok: false, error: auth.error };
    const key = process.env.BRIDGE_API_KEY?.trim();
    const customer = process.env.BRIDGE_CUSTOMER_ID?.trim();
    if (!key || !customer) {
      return {
        ok: false,
        error:
          "Lead Bank issues this number through Bridge, then the dollars land as USDC on this wallet. The program key is not on the server, so there is no number to copy.",
      };
    }
    let res: Response;
    try {
      res = await fetchWithTimeout(`${BRIDGE}/customers/${encodeURIComponent(customer)}/virtual_accounts`, {
        method: "POST",
        headers: {
          "Api-Key": key,
          "Content-Type": "application/json",
          "Idempotency-Key": `senda-${owner}-${data.currency}`,
        },
        body: JSON.stringify({
          source: { currency: data.currency },
          destination: { currency: "usdc", payment_rail: "solana", address: owner },
        }),
      });
    } catch (e) {
      const timeout = e instanceof Error && e.name === "TimeoutError";
      console.error("[receive-account] Bridge request failed", timeout ? "timeout" : e instanceof Error ? e.message : e);
      return { ok: false, error: bridgeUserError(timeout ? "timeout" : "network") };
    }
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      source_deposit_instructions?: BridgeInstructions;
    };
    if (!res.ok) {
      // Provider text stays in server logs; the client gets a fixed message per status.
      console.error("[receive-account] Bridge error", res.status, body.code ?? "", String(body.message ?? "").slice(0, 200));
      return { ok: false, error: bridgeUserError(res.status) };
    }
    const s = body.source_deposit_instructions ?? {};
    const account = s.bank_account_number || s.iban || s.clabe || "";
    if (!account) return { ok: false, error: bridgeUserError(502) };
    return {
      ok: true,
      currency: data.currency,
      beneficiary: s.bank_beneficiary_name || s.account_holder_name || "",
      account,
      routing: s.bank_routing_number || "",
      wire: s.bank_routing_number || s.bic || "",
      iban: s.iban || "",
      bic: s.bic || "",
      bank: s.bank_name || "",
      address: s.bank_address || "",
    };
  });
