/**
 * Same bytes as chain/senda-chain (Rust) and chain/python/senda.
 * A payment is SPL Token Transfer, discriminator 3, then the USDC atoms.
 * A cover is that transfer plus this memo. The wallet signs. No program id is added on mainnet.
 * The cover account program is deployed on devnet only: chain/devnet.json.
 */

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const COVER_PROGRAM_DEVNET = "4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta";

export function usdToAtoms(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("amount");
  const atoms = BigInt(Math.round(usd * 1_000_000));
  if (atoms <= 0n) throw new Error("amount");
  return atoms;
}

/** SPL Token Transfer. Discriminator 3, amount little-endian. Nine bytes. */
export function transferData(atoms: bigint): Uint8Array {
  if (atoms <= 0n || atoms > 0xffff_ffff_ffff_ffffn) throw new Error("amount");
  const data = new Uint8Array(9);
  data[0] = 3;
  new DataView(data.buffer).setBigUint64(1, atoms, true);
  return data;
}

export function payMemo(usd: number, reference: string): string {
  return `Senda USDC ${usd.toFixed(2)} ref=${reference}`;
}

export type CoverKindWord = "drop" | "drop5" | "life";

/** Terms in the memo. Strike, cover, and premium are atoms. `until` is a unix second. */
export function coverMemo(input: {
  kind: CoverKindWord;
  symbol: string;
  strikeUsd: number;
  coverUsd: number;
  premiumUsd: number;
  until: number;
}): string {
  const symbol = input.symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!symbol) throw new Error("symbol");
  const strike = input.strikeUsd > 0 ? usdToAtoms(input.strikeUsd) : 0n;
  const cover = usdToAtoms(input.coverUsd);
  const premium = usdToAtoms(input.premiumUsd);
  return `Senda cover ${input.kind} ${symbol} strike=${strike} cover=${cover} premium=${premium} until=${Math.floor(input.until)}`;
}
