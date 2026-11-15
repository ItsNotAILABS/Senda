/** Standard base64. No btoa or atob. Those throw on this phone. */

const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function b64e(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += A[(n >> 18) & 63] + A[(n >> 12) & 63];
    out += i + 1 < bytes.length ? A[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? A[n & 63] : "=";
  }
  return out;
}

export function b64d(value: string): Uint8Array {
  const clean = value.replace(/[\r\n\s]/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = clean.length % 4 === 0 ? clean : clean + "=".repeat(4 - (clean.length % 4));
  const out: number[] = [];
  for (let i = 0; i < pad.length; i += 4) {
    const a = A.indexOf(pad[i]);
    const b = A.indexOf(pad[i + 1]);
    const c = pad[i + 2] === "=" ? -2 : A.indexOf(pad[i + 2]);
    const d = pad[i + 3] === "=" ? -2 : A.indexOf(pad[i + 3]);
    if (a < 0 || b < 0 || c === -1 || d === -1) throw new Error("The sealed box is not readable.");
    const n = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    out.push((n >> 16) & 255);
    if (c >= 0) out.push((n >> 8) & 255);
    if (d >= 0) out.push(n & 255);
  }
  return Uint8Array.from(out);
}
