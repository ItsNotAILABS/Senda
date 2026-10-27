/**
 * The cover account program deployed on devnet. See chain/devnet.json.
 * Mainnet payments do not call this. They are an SPL USDC transfer plus the memo in chain-codec.
 * Instruction data is 45 bytes: kind, 12-byte symbol, four little-endian u64s.
 */

export const PROGRAM_ID = "4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta";

export function encodeCover(input: {
  kind: 0 | 1;
  symbol: string;
  strike: bigint;
  cover: bigint;
  premium: bigint;
  until: bigint;
}): Uint8Array {
  const data = new Uint8Array(45);
  data[0] = input.kind;
  const symbol = new TextEncoder().encode(input.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12));
  data.set(symbol, 1);
  const view = new DataView(data.buffer);
  view.setBigUint64(13, input.strike, true);
  view.setBigUint64(21, input.cover, true);
  view.setBigUint64(29, input.premium, true);
  view.setBigUint64(37, input.until, true);
  return data;
}
