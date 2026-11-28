/** The native treasury account. Other programs read these 92 bytes. Draw is byte 10. */

export const TREASURY_PROGRAM_ID = "DeJVhSszpHrwHonu78hnYxrQxcr6ZEuYgwZmzYQYXpwy";
export const ANCHOR_FUND_PROGRAM_ID = "FdcRjiN8GJmibutLtubvDf8hXavsYpBe7ZAHEyV5VjLJ";
export const SEAHORSE_NOTE_PROGRAM_ID = "Ffn59migb5ED6szzphrgkrcdX1f8418ujB5JFcpJR2bk";
export const TREASURY_LEN = 92;

export type TreasuryAccount = {
  bump: number;
  spendOpen: boolean;
  authority: Uint8Array;
  funded: bigint;
  fundCount: bigint;
  lastFunder: Uint8Array;
};

export function packTreasury(row: TreasuryAccount): Uint8Array {
  const out = new Uint8Array(TREASURY_LEN);
  out.set([0x53, 0x45, 0x4e, 0x44, 0x41, 0x54, 0x52, 0x59, 1, row.bump, row.spendOpen ? 1 : 0, 0]);
  out.set(row.authority.subarray(0, 32), 12);
  const view = new DataView(out.buffer);
  view.setBigUint64(44, row.funded, true);
  view.setBigUint64(52, row.fundCount, true);
  out.set(row.lastFunder.subarray(0, 32), 60);
  return out;
}

export function unpackTreasury(data: Uint8Array): TreasuryAccount | null {
  if (data.length < TREASURY_LEN) return null;
  const magic = String.fromCharCode(...data.subarray(0, 8));
  if (magic !== "SENDATRY" || data[8] !== 1) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    bump: data[9],
    spendOpen: data[10] === 1,
    authority: data.slice(12, 44),
    funded: view.getBigUint64(44, true),
    fundCount: view.getBigUint64(52, true),
    lastFunder: data.slice(60, 92),
  };
}

/** Instruction 1. The native program transfers the lamports and writes the account. */
export function fundData(lamports: bigint): Uint8Array | null {
  if (lamports <= 0n) return null;
  const out = new Uint8Array(9);
  out[0] = 1;
  new DataView(out.buffer).setBigUint64(1, lamports, true);
  return out;
}
