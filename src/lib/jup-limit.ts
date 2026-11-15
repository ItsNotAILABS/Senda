/** A Jupiter Trigger limit order. Jupiter builds it. The wallet signs it. It is not a market swap. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CREATE = "https://lite-api.jup.ag/trigger/v1/createOrder";
const EXECUTE = "https://lite-api.jup.ag/trigger/v1/execute";

export const jupLimitCreate = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      maker: z.string().min(32).max(48),
      inputMint: z.string().min(32).max(48),
      outputMint: z.string().min(32).max(48),
      makingAmount: z.string().regex(/^\d+$/),
      takingAmount: z.string().regex(/^\d+$/),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await fetch(CREATE, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        maker: data.maker,
        payer: data.maker,
        inputMint: data.inputMint,
        outputMint: data.outputMint,
        params: { makingAmount: data.makingAmount, takingAmount: data.takingAmount },
        computeUnitPrice: "auto",
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { requestId?: string; transaction?: string; error?: string; code?: number };
    if (!res.ok || !json.transaction || !json.requestId) {
      return { ok: false as const, reason: json.error || `Jupiter limit ${res.status}` };
    }
    return { ok: true as const, requestId: json.requestId, transaction: json.transaction };
  });

export const jupLimitExecute = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ requestId: z.string().min(8), signedTransaction: z.string().min(20) }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(EXECUTE, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(12000),
    });
    const json = (await res.json()) as { signature?: string; status?: string; error?: string };
    if (!res.ok || !json.signature) return { ok: false as const, reason: json.error || `Jupiter limit execute ${res.status}` };
    return { ok: true as const, signature: json.signature, status: json.status || "sent" };
  });

export type RestingOrder = {
  order: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
};

/** Jupiter builds the trigger order. The connected wallet signs it. It rests. */
export async function placeLimit(input: {
  maker: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
}): Promise<{ signature: string; order: string }> {
  const { Buffer } = await import("buffer");
  const { VersionedTransaction } = await import("@solana/web3.js");
  const { requirePhantom, broadcastSigned } = await import("@/lib/phantom");
  const res = await fetch(CREATE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      inputMint: input.inputMint,
      outputMint: input.outputMint,
      maker: input.maker,
      payer: input.maker,
      params: { makingAmount: input.makingAmount, takingAmount: input.takingAmount },
      computeUnitPrice: "auto",
    }),
  });
  const body = (await res.json()) as { transaction?: string; order?: string; error?: string; message?: string };
  if (!res.ok || !body.transaction) {
    throw new Error(body.error || body.message || `Jupiter did not build the limit order (${res.status}).`);
  }
  const tx = VersionedTransaction.deserialize(Buffer.from(body.transaction, "base64"));
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  const signature = await broadcastSigned(signed);
  return { signature, order: body.order || signature };
}

const LIST = "https://lite-api.jup.ag/trigger/v1/getTriggerOrders";

export async function restingOrders(maker: string): Promise<RestingOrder[]> {
  const res = await fetch(`${LIST}?user=${maker}&orderStatus=active`, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const body = (await res.json()) as { orders?: RestingOrder[] } | RestingOrder[];
  const rows = Array.isArray(body) ? body : body.orders || [];
  return rows.filter((row) => row && row.order);
}
