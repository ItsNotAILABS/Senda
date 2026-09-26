import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  issueChallenge,
  consumeProof,
  createSession,
  requireSession,
  saveVault,
  validBox,
} from "./wallet-security";

const wallet = z.string().min(32).max(48);
const proof = z.object({ wallet, nonce: z.string().uuid(), sig: z.string().max(120) });
const session = z.object({ wallet, token: z.string().length(72) });
async function sql() {
  return (await import("@/lib/db")).getSql();
}
export const openNonce = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ wallet }).parse(input))
  .handler(async ({ data }) => issueChallenge(await sql(), data.wallet, "sync"));
export const finishGrant = createServerFn({ method: "POST" })
  .validator((input: unknown) => proof.parse(input))
  .handler(async ({ data }) => {
    const db = await sql();
    if (!(await consumeProof(db, data.wallet, "sync", data.nonce, data.sig)))
      throw new Error("Wallet proof expired or already used.");
    return { token: await createSession(db, data.wallet) };
  });
export const readVault = createServerFn({ method: "POST" })
  .validator((input: unknown) => session.parse(input))
  .handler(async ({ data }) => {
    const db = await sql();
    await requireSession(db, data.wallet, data.token);
    const rows = await db<{
      box: string;
      revision: number;
    }>`select box,revision from sealed_vault where wallet=${data.wallet}`;
    const legacy = rows.length
      ? []
      : await db<{
          slot: string;
          box: string;
        }>`select slot,box from sealed_blob where wallet=${data.wallet}`;
    return { vault: rows[0] ?? null, legacy };
  });
export const writeVault = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    session
      .extend({
        box: z.string().refine(validBox),
        revision: z.number().int().min(0).max(2147483646),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const db = await sql();
    await requireSession(db, data.wallet, data.token);
    return { revision: await saveVault(db, data.wallet, data.box, data.revision) };
  });
