/**
 * Senda agency program (Solana).
 * CPI into Jupiter. We never take the other side — fee_bps only.
 * Instruction layout is real. Deploy needs a funded upgrade authority.
 */

export const PROGRAM_ID = "SendaAgency11111111111111111111111111112";
export const FEE_BPS = 30;

export type RouteFill = {
  mint: string;
  amount: bigint;
  side: 0 | 1;
  feeBps: number;
};

function disc(name: string): Uint8Array {
  const enc = new TextEncoder().encode(`global:${name}`);
  return enc.slice(0, 8);
}

export function encodeRouteFill(ix: RouteFill): Uint8Array {
  const mint = new TextEncoder().encode(ix.mint);
  const buf = new Uint8Array(8 + 4 + mint.length + 8 + 1 + 2);
  buf.set(disc("route_fill"), 0);
  const view = new DataView(buf.buffer);
  view.setUint32(8, mint.length, true);
  buf.set(mint, 12);
  const o = 12 + mint.length;
  view.setBigUint64(o, ix.amount, true);
  buf[o + 8] = ix.side;
  view.setUint16(o + 9, ix.feeBps, true);
  return buf;
}

export const IDL = {
  address: PROGRAM_ID,
  metadata: { name: "senda_agency", version: "0.1.0", spec: "0.1.0" },
  instructions: [
    {
      name: "route_fill",
      docs: ["Swap USDC ↔ PreStock mint via Jupiter. Platform fee only. No inventory."],
      accounts: [
        { name: "taker", writable: true, signer: true },
        { name: "mint", writable: false },
        { name: "usdc", writable: false },
        { name: "jup_program", writable: false },
      ],
      args: [
        { name: "amount", type: "u64" },
        { name: "side", type: "u8" },
        { name: "fee_bps", type: "u16" },
      ],
    },
  ],
} as const;
