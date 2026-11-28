/** One Buffer for the browser. The head used to install a stub whose alloc() returned a bare Uint8Array. web3.js then did realBuffer.copy(that) while padding a public key and threw "argument should be a Buffer". */

import { Buffer } from "buffer";

type Buf = typeof Buffer;

let installed = false;

export function installSendBuffer(): Buf {
  const real = Buffer;
  if (!installed) {
    installed = true;
    const isBuffer = real.isBuffer.bind(real);
    // copy() asks isBuffer. A Uint8Array view is a valid target; the write is Uint8Array.set.
    real.isBuffer = ((value: unknown) => isBuffer(value) || value instanceof Uint8Array) as Buf["isBuffer"];
  }
  const g = globalThis as typeof globalThis & { Buffer?: Buf };
  g.Buffer = real;
  return real;
}

installSendBuffer();
