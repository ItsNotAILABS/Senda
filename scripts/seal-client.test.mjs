import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
class Storage {
  values = new Map();
  get length() {
    return this.values.size;
  }
  key(i) {
    return [...this.values.keys()][i] ?? null;
  }
  getItem(k) {
    return this.values.get(k) ?? null;
  }
  setItem(k, v) {
    this.values.set(k, String(v));
  }
  removeItem(k) {
    this.values.delete(k);
  }
}
globalThis.Storage = Storage;
globalThis.localStorage = new Storage();
const sessionStorage = new Storage();
const win = new EventTarget();
win.location = { reload() {} };
globalThis.window = win;
let remote = null,
  writes = 0;
globalThis.sealedApi = {
  openNonce: async () => ({ nonce: "test", message: "approval" }),
  finishGrant: async () => ({ token: "token" }),
  readVault: async () => ({ vault: remote, legacy: [] }),
  writeVault: async ({ data }) => {
    if (data.revision !== (remote?.revision ?? 0)) throw Error("conflict");
    remote = { box: data.box, revision: data.revision + 1 };
    writes++;
    return { revision: remote.revision };
  },
};
const key = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
win.solana = {
  publicKey: { toString: () => "wallet-a" },
  signMessage: async (msg) =>
    new Uint8Array(await crypto.subtle.sign("Ed25519", key.privateKey, msg)),
};
localStorage.setItem("senda.test.v1", "legacy record");
const source = (await readFile(new URL("../src/lib/seal.ts", import.meta.url), "utf8")).replace(
  /import .* from "@\/lib\/sealed-store";/,
  "const {finishGrant,readVault,openNonce,writeVault}=globalThis.sealedApi;",
);
const js = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const seal = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
async function until(fn) {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("timed out");
}
test("migration, ciphertext-only snapshots, deletion, locking and wallet mismatch", async () => {
  assert.equal(localStorage.getItem("senda.test.v1"), null);
  sessionStorage.setItem("senda.test.v1", "session-only");
  assert.equal(sessionStorage.getItem("senda.test.v1"), "session-only");
  await seal.unlockSeal("wallet-a");
  await until(() => writes === 1);
  assert.equal(localStorage.getItem("senda.test.v1"), "legacy record");
  assert.equal(localStorage.values.has("senda.test.v1"), false);
  assert.ok(remote.box.startsWith("sen2."));
  assert.equal(remote.box.includes("senda.test"), false);
  localStorage.removeItem("senda.test.v1");
  await until(() => writes === 2);
  assert.equal(localStorage.getItem("senda.test.v1"), null);
  seal.lockSeal();
  assert.equal(seal.sealOpen(), false);
  await seal.unlockSeal("wallet-a");
  assert.equal(localStorage.getItem("senda.test.v1"), null);
  seal.lockSeal();
  await assert.rejects(seal.unlockSeal("wallet-b"), /matching wallet/);
  assert.equal(seal.sealOpen(), false);
});
test("conflicting remote save preserves dirty local ciphertext", async () => {
  await seal.unlockSeal("wallet-a");
  remote = { ...remote, revision: remote.revision + 1 };
  localStorage.setItem("senda.test.v1", "offline change");
  await until(() => JSON.parse(localStorage.values.get("sealed-vault.v2.wallet-a")).dirty);
  await new Promise((r) => setTimeout(r, 650));
  seal.lockSeal();
  await seal.unlockSeal("wallet-a");
  assert.equal(localStorage.getItem("senda.test.v1"), "offline change");
  assert.equal(writes, 2);
  seal.lockSeal();
});
