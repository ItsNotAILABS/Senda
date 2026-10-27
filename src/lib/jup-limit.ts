/**
 * A Jupiter trigger order. The maker wallet signs. It rests until the taking amount is available.
 * Senda does not match it.
 */

import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import { requirePhantom, broadcastSigned } from "@/lib/phantom";

const CREATE = "https://lite-api.jup.ag/trigger/v1/createOrder";
const LIST = "https://lite-api.jup.ag/trigger/v1/getTriggerOrders";

export type RestingOrder = {
  order: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
};

export async function placeLimit(input: {
  maker: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
}): Promise<{ signature: string; order: string }> {
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

export async function restingOrders(maker: string): Promise<RestingOrder[]> {
  const res = await fetch(`${LIST}?user=${maker}&orderStatus=active`, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const body = (await res.json()) as { orders?: RestingOrder[] } | RestingOrder[];
  const rows = Array.isArray(body) ? body : body.orders || [];
  return rows.filter((row) => row && row.order);
}
