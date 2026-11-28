import assert from "node:assert/strict";
import test from "node:test";
import { mapPasskeyError, parsePasskey, passkeyBlocksVisit } from "./passkey.ts";

test("a short or broken record is not a passkey", () => {
  assert.equal(parsePasskey(null), null);
  assert.equal(parsePasskey(""), null);
  assert.equal(parsePasskey("{"), null);
  assert.equal(parsePasskey(JSON.stringify({ id: "short", created: 1 })), null);
});

test("a stored id blocks the visit until it matches", () => {
  const row = parsePasskey(JSON.stringify({ id: "abcdefghij", created: 5 }));
  assert.ok(row);
  assert.equal(passkeyBlocksVisit(null, ""), false);
  assert.equal(passkeyBlocksVisit(row, ""), true);
  assert.equal(passkeyBlocksVisit(row, "other-key"), true);
  assert.equal(passkeyBlocksVisit(row, row.id), false);
});

test("a dismissed prompt is not a saved passkey", () => {
  const err = mapPasskeyError(new DOMException("no", "NotAllowedError"), "fallback");
  assert.match(err.message, /dismissed/);
});
