/**
 * Postgres holds the sealed desk. It checks the wallet signature.
 * It never receives the key, and it rejects anything that is not ciphertext.
 */

import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

const SLOT = /^(senda|the-pit)\.[a-z0-9._-]{1,80}$/;
const SKIP = new Set(["senda.seen.v1", "senda.howto.v1"]);
const BOX = /^sen1\.[A-Za-z0-9+/]+=*\.[A-Za-z0-9+/]+=*$/;

const wallet = z.string().min(32).max(48);
const nonce = z.string().regex(/^[a-f0-9]{32}$/);
const slot = z.string().regex(SLOT).refine((s) => !SKIP.has(s));
const box = z.string().min(20).max(400_000).regex(BOX);
const sig = z.string().min(80).max(120);

async function sql() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function bytesOf(value: string): Uint8Array {
  return new PublicKey(value).toBytes();
}

async function verify(owner: string, message: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    bytesOf(owner),
    { name: "Ed25519" } as AlgorithmIdentifier,
    false,
    ["verify"],
  );
  const raw = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  return crypto.subtle.verify({ name: "Ed25519" } as AlgorithmIdentifier, key, raw, new TextEncoder().encode(message));
}

async function granted(owner: string, proof: string): Promise<boolean> {
  const db = await sql();
  const rows = await db<{ ok: number }>`
    select 1 as ok from sealed_grant
    where wallet = ${owner} and nonce = ${proof} and expires_at > now()
  `;
  return rows.length > 0;
}

export const openNonce = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ wallet }).parse(input))
  .handler(async ({ data }) => {
    bytesOf(data.wallet);
    const fresh = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    return { nonce: fresh };
  });

export const finishGrant = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ wallet, nonce, sig }).parse(input))
  .handler(async ({ data }) => {
    const ok = await verify(data.wallet, `senda-grant:v1:${data.wallet}:${data.nonce}`, data.sig);
    if (!ok) return { ok: false as const };
    const db = await sql();
    await db`
      insert into sealed_grant (wallet, nonce, expires_at)
      values (${data.wallet}, ${data.nonce}, now() + interval '12 hours')
      on conflict (wallet) do update set nonce = excluded.nonce, expires_at = excluded.expires_at
    `;
    return { ok: true as const };
  });

export const putBlob = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ wallet, nonce, slot, box }).parse(input))
  .handler(async ({ data }) => {
    if (!(await granted(data.wallet, data.nonce))) return { ok: false as const };
    const db = await sql();
    await db`
      insert into sealed_blob (wallet, slot, box)
      values (${data.wallet}, ${data.slot}, ${data.box})
      on conflict (wallet, slot) do update set box = excluded.box
    `;
    return { ok: true as const };
  });

export const listBlobs = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ wallet, nonce }).parse(input))
  .handler(async ({ data }) => {
    if (!(await granted(data.wallet, data.nonce))) return { rows: [] as { slot: string; box: string }[] };
    const db = await sql();
    const rows = await db<{ slot: string; box: string }>`
      select slot, box from sealed_blob where wallet = ${data.wallet}
    `;
    return { rows };
  });
