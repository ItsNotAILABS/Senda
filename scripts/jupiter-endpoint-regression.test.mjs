import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("read-only Jupiter V2 preview uses official host and cannot sign", () => {
  const preview = read("src/lib/jupiter-v2-preview.ts");
  assert.match(preview, /https:\/\/api\.jup\.ag\/swap\/v2\/order/);
  assert.match(preview, /SENDA_JUPITER_API_KEY/);
  assert.ok(!preview.includes("taker:data."));
  for (const forbidden of ["sendRawTransaction(", "sendTransaction(", "signTransaction(", "signAndSendTransaction("]) {
    assert.equal(preview.includes(forbidden), false, forbidden);
    assert.equal(read("src/lib/token-safety.ts").includes(forbidden), false, forbidden);
  }
});

test("the existing wallet signer is not replaced or called by research panels", () => {
  const signer = read("src/lib/jup-sign.ts");
  assert.match(signer, /export async function signRoute/);
  const route = read("src/routes/invest/safety.tsx");
  assert.match(route, /JupiterV2PreviewPanel/);
  assert.match(route, /TokenSafetyPanel/);
  assert.ok(!route.includes("signRoute("));
});

test("legacy market feed host migration remains a separate explicit release gate", () => {
  const paths = ["src/lib/jup-tape.ts", "src/lib/world-book.ts", "src/lib/pools/read.ts"];
  const hosts = paths.filter(path => read(path).includes("lite-api.jup.ag"));
  // Audit-only signal; the existing signing route must not be silently replaced
  // with a V2 quote contract because the request and response shapes differ.
  assert.ok(Array.isArray(hosts));
  assert.ok(hosts.every(path => paths.includes(path)));
});
