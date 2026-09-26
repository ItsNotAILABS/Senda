/** Provider accounts require verified wallet/customer binding and a one-time approval. */

import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { boundCustomer, consumeProof, issueChallenge } from "./wallet-security";

export const receiveChallenge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({ wallet: z.string().min(32).max(48), currency: z.enum(["usd", "eur", "mxn"]) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const db = await (await import("./db")).getSql();
    await boundCustomer(db, data.wallet);
    return issueChallenge(db, data.wallet, `receive:${data.currency}`);
  });

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
  .validator((input: unknown) =>
    z
      .object({
        wallet: z.string().min(32).max(48),
        nonce: z.string().uuid(),
        sig: z.string().max(120),
        currency: z.enum(["usd", "eur", "mxn"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<IssuedAccount | { ok: false; error: string }> => {
    let owner: string;
    try {
      owner = new PublicKey(data.wallet).toBase58();
    } catch {
      return { ok: false, error: "That is not a Solana address." };
    }
    const key = process.env.BRIDGE_API_KEY?.trim();
    if (!key) {
      return {
        ok: false,
        error:
          "Lead Bank issues this number through Bridge, then the dollars land as USDC on this wallet. The program key is not on the server, so there is no number to copy.",
      };
    }
    const db = await (await import("./db")).getSql();
    if (!(await consumeProof(db, owner, `receive:${data.currency}`, data.nonce, data.sig))) {
      return { ok: false, error: "Approve this account request with your wallet again." };
    }
    const customer = await boundCustomer(db, owner);
    const res = await fetch(
      `${BRIDGE}/customers/${encodeURIComponent(customer)}/virtual_accounts`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "Api-Key": key,
          "Content-Type": "application/json",
          "Idempotency-Key": `senda-${customer}-${owner}-${data.currency}`,
        },
        body: JSON.stringify({
          source: { currency: data.currency },
          destination: { currency: "usdc", payment_rail: "solana", address: owner },
        }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      source_deposit_instructions?: BridgeInstructions;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: "The provider could not open the account. Please try again later.",
      };
    }
    const s = body.source_deposit_instructions ?? {};
    const account = s.bank_account_number || s.iban || s.clabe || "";
    if (!account)
      return { ok: false, error: "Bridge answered, but it did not include an account number." };
    return {
      ok: true,
      currency: data.currency,
      beneficiary: s.bank_beneficiary_name || s.account_holder_name || "",
      account,
      routing: s.bank_routing_number || "",
      wire: "",
      iban: s.iban || "",
      bic: s.bic || "",
      bank: s.bank_name || "",
      address: s.bank_address || "",
    };
  });
