/** Read one devnet account. Mainnet is never queried. An empty address keeps agent spending off. */

import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";
import { PARALLAX_RPC } from "./parallax-devnet.ts";
import { unpackTreasury } from "./treasury-ix.ts";

export type TreasuryCheck = { verified: boolean; spendOpen: boolean; address: string; lamports: number; why: string };

function closed(why: string, address = "", lamports = 0, verified = false): TreasuryCheck {
  return { verified, spendOpen: false, address, lamports, why };
}

export const parallaxTreasury = createServerFn({ method: "GET" }).handler(async (): Promise<TreasuryCheck> => {
  const raw = (process.env.PARALLAX_DEVNET_TREASURY || "").trim();
  if (!raw) return closed("No Parallax devnet treasury is configured. Agent spending stays off.");
  let address = "";
  try {
    address = new PublicKey(raw).toBase58();
  } catch {
    return closed("The treasury address is not a Solana address. Agent spending stays off.");
  }
  try {
    const res = await fetch(PARALLAX_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [address, { encoding: "base64", commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { result?: { value?: { lamports?: number; data?: [string, string] } | null } };
    const value = json.result?.value;
    if (!value || !Number.isFinite(value.lamports)) {
      return closed("That address has no account on devnet. Agent spending stays off.", address);
    }
    const rawData = value.data?.[0] ? Uint8Array.from(Buffer.from(value.data[0], "base64")) : new Uint8Array();
    const account = unpackTreasury(rawData);
    return {
      verified: true,
      spendOpen: account?.spendOpen === true,
      address,
      lamports: value.lamports,
      why: account
        ? "The program account is on devnet. Draw follows byte 10. This is not an audit, and it is not mainnet."
        : "A devnet account was found, but it is not the SENDATRY treasury. Draw stays closed.",
    };
  } catch {
    return closed("Devnet did not answer. Agent spending stays off.", address);
  }
});
