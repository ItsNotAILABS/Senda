import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { PublicKey } from "@solana/web3.js";
const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/lib/wallet-security.ts", import.meta.url), "utf8");
const js = ts
  .transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })
  .replace(
    '"@solana/web3.js"',
    JSON.stringify(pathToFileURL(require.resolve("@solana/web3.js")).href),
  );
const security = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const pg = new PGlite();
await pg.exec(await readFile(new URL("../migrations/0006_sealed.sql", import.meta.url), "utf8"));
await pg.exec(
  await readFile(new URL("../migrations/0007_wallet_security.sql", import.meta.url), "utf8"),
);
const db = async (parts, ...values) =>
  (
    await pg.query(
      parts.reduce((s, p, i) => s + (i ? "$" + i : "") + p, ""),
      values,
    )
  ).rows;
const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
const wallet = new PublicKey(
  new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)),
).toBase58();
const sign = async (message) =>
  Buffer.from(
    await crypto.subtle.sign("Ed25519", pair.privateKey, new TextEncoder().encode(message)),
  ).toString("base64");
const box =
  "sen2." + Buffer.alloc(12, 1).toString("base64") + "." + Buffer.alloc(16, 2).toString("base64");
test.after(() => pg.close());
test("single-use proof rejects replay, wrong purpose, wallet and signature", async () => {
  const c = await security.issueChallenge(db, wallet, "sync");
  const sig = await sign(c.message);
  assert.equal(await security.consumeProof(db, wallet, "receive:usd", c.nonce, sig), false);
  assert.equal(await security.consumeProof(db, wallet, "sync", c.nonce, "bad"), false);
  const results = await Promise.all(
    [1, 2].map(() => security.consumeProof(db, wallet, "sync", c.nonce, sig)),
  );
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await security.consumeProof(db, wallet, "sync", c.nonce, sig), false);
});
test("expired and superseded challenges fail", async () => {
  const a = await security.issueChallenge(db, wallet, "sync");
  await security.issueChallenge(db, wallet, "sync");
  assert.equal(
    await security.consumeProof(db, wallet, "sync", a.nonce, await sign(a.message)),
    false,
  );
  const b = await security.issueChallenge(db, wallet, "sync");
  await pg.exec("update wallet_challenge set expires_at=now()-interval '1 second'");
  assert.equal(
    await security.consumeProof(db, wallet, "sync", b.nonce, await sign(b.message)),
    false,
  );
});
test("sessions are hashed, wallet-scoped and expire", async () => {
  const token = await security.createSession(db, wallet);
  await security.requireSession(db, wallet, token);
  await assert.rejects(security.requireSession(db, "other", token));
  const rows = await pg.query("select token_hash from wallet_session");
  assert.notEqual(rows.rows[0].token_hash, token);
  await pg.exec("update wallet_session set expires_at=now()-interval '1 second'");
  await assert.rejects(security.requireSession(db, wallet, token));
});
test("vault saves reject stale and concurrent overwrites", async () => {
  assert.equal(await security.saveVault(db, wallet, box, 0), 1);
  await assert.rejects(security.saveVault(db, wallet, box, 0), /conflict/);
  const saves = await Promise.allSettled([1, 2].map(() => security.saveVault(db, wallet, box, 1)));
  assert.equal(saves.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(security.saveVault(db, "missing", box, 5), /conflict/);
  await assert.rejects(security.saveVault(db, wallet, "plaintext", 2));
});
test("customer binding fails closed, is wallet-specific and revocable", async () => {
  await assert.rejects(security.boundCustomer(db, wallet));
  await db`insert into bridge_wallet_customer(wallet,customer_id,verified_at) values(${wallet},'customer-a',now())`;
  assert.equal(await security.boundCustomer(db, wallet), "customer-a");
  await assert.rejects(security.boundCustomer(db, "other"));
  await pg.exec("update bridge_wallet_customer set revoked_at=now()");
  await assert.rejects(security.boundCustomer(db, wallet));
});
test("bank proofs are currency-bound", async () => {
  const c = await security.issueChallenge(db, wallet, "receive:usd");
  const sig = await sign(c.message);
  assert.equal(await security.consumeProof(db, wallet, "receive:eur", c.nonce, sig), false);
  assert.equal(await security.consumeProof(db, wallet, "receive:usd", c.nonce, sig), true);
});
