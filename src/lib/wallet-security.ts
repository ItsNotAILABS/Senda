import { PublicKey } from "@solana/web3.js";
import type { Sql } from "./db";

export type Purpose = "sync" | "receive:usd" | "receive:eur" | "receive:mxn";
export const proofMessage = (wallet: string, purpose: Purpose, nonce: string) =>
  `Senda wallet authorization v2\nWallet: ${wallet}\nAction: ${purpose}\nChallenge: ${nonce}`;
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function issueChallenge(db: Sql, wallet: string, purpose: Purpose) {
  new PublicKey(wallet);
  const nonce = crypto.randomUUID();
  await db`insert into wallet_challenge(wallet,purpose,nonce,expires_at)
    values (${wallet},${purpose},${nonce},now()+interval '5 minutes')
    on conflict(wallet,purpose) do update set nonce=excluded.nonce,expires_at=excluded.expires_at`;
  return { nonce, message: proofMessage(wallet, purpose, nonce) };
}
export async function consumeProof(
  db: Sql,
  wallet: string,
  purpose: Purpose,
  nonce: string,
  sig: string,
) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(new PublicKey(wallet).toBytes()),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const bytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    if (
      bytes.length !== 64 ||
      !(await crypto.subtle.verify(
        "Ed25519",
        key,
        bytes,
        new TextEncoder().encode(proofMessage(wallet, purpose, nonce)),
      ))
    )
      return false;
    // Atomic deletion makes concurrent and subsequent replays fail.
    const rows = await db`delete from wallet_challenge where wallet=${wallet} and purpose=${purpose}
      and nonce=${nonce} and expires_at>now() returning wallet`;
    return rows.length === 1;
  } catch {
    return false;
  }
}
export async function createSession(db: Sql, wallet: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const hash = await digest(token);
  await db`delete from wallet_session where expires_at<=now()`;
  await db`insert into wallet_session(token_hash,wallet,expires_at) values(${hash},${wallet},now()+interval '12 hours')`;
  return token;
}
export async function requireSession(db: Sql, wallet: string, token: string) {
  const hash = await digest(token);
  const rows =
    await db`select 1 from wallet_session where wallet=${wallet} and token_hash=${hash} and expires_at>now()`;
  if (rows.length !== 1) throw new Error("Unlock your wallet again to sync.");
}
export async function boundCustomer(db: Sql, wallet: string): Promise<string> {
  const rows = await db<{ customer_id: string }>`select customer_id from bridge_wallet_customer
    where wallet=${wallet} and revoked_at is null and verified_at<=now()`;
  if (rows.length !== 1)
    throw new Error("Complete verified account onboarding for this wallet first.");
  return rows[0].customer_id;
}
export function validBox(value: string): boolean {
  if (value.length > 2_000_000) return false;
  const parts = /^sen2\.([A-Za-z0-9+/]+={0,2})\.([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!parts) return false;
  try {
    return atob(parts[1]).length === 12 && atob(parts[2]).length >= 16;
  } catch {
    return false;
  }
}
export async function saveVault(db: Sql, wallet: string, box: string, revision: number) {
  if (!validBox(box)) throw new Error("Invalid encrypted vault.");
  const rows = await db<{ revision: number }>`insert into sealed_vault(wallet,box,revision)
    select ${wallet},${box},1 where ${revision}=0 or exists(select 1 from sealed_vault where wallet=${wallet})
    on conflict(wallet) do update set box=excluded.box,revision=sealed_vault.revision+1
    where sealed_vault.revision=${revision} returning revision`;
  if (!rows.length)
    throw new Error(
      "Sync conflict: another device saved a newer vault. Your local copy is preserved.",
    );
  return rows[0].revision;
}
