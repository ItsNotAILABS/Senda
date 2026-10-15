/** Live clearing posture. Mastercard readiness comes from the worker environment. */

import { createServerFn } from "@tanstack/react-start";
import { clearingPosture } from "@/lib/clearing-posture.mjs";

export async function fetchClearing() {
  const posture = clearingPosture();
  const { connectConfig } = await import("@/lib/mastercard-oauth.mjs");
  const card = connectConfig(process.env);
  return {
    ...posture,
    mastercardReady: Boolean(card.ready),
    mastercardMissing: card.missing as string[],
  };
}

export const getClearing = createServerFn({ method: "GET" }).handler(async () => fetchClearing());
