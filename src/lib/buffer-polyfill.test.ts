import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import { installSendBuffer } from "./buffer-polyfill.ts";

test("a short public key pads without throwing", () => {
  const stub = function Stub() {} as unknown as typeof Buffer;
  stub.from = (() => new Uint8Array()) as unknown as typeof Buffer.from;
  stub.alloc = ((size?: number) => new Uint8Array(size ?? 0)) as unknown as typeof Buffer.alloc;
  stub.allocUnsafe = stub.alloc;
  stub.allocUnsafeSlow = stub.alloc;
  stub.isBuffer = (() => false) as unknown as typeof Buffer.isBuffer;
  stub.prototype = {} as typeof Buffer.prototype;
  (globalThis as { Buffer?: typeof Buffer }).Buffer = stub;

  const Buffer = installSendBuffer();
  const key = new PublicKey("So11111111111111111111111111111111111111112");
  const padded = key.toBuffer();
  assert.equal(padded.length, 32);
  assert.equal(Buffer.isBuffer(padded), true);

  const view = new Uint8Array(8);
  Buffer.from([9, 8, 7]).copy(view, 2);
  assert.deepEqual(Array.from(view), [0, 0, 9, 8, 7, 0, 0, 0]);
});
