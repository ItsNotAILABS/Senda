/** Live earn rates. A row can be signed only when the receipt has a mint Jupiter can quote. */

import { VAULT_RECEIPTS, loadKaminoVaults } from "@/lib/vault-book";

const MARKET = "https://api.kamino.finance/kamino-market/7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF/reserves/metrics";
const VAULT_METRICS = "https://api.kamino.finance/kvaults/vaults/metrics";
const MARINADE = "https://api.marinade.finance/msol/apy/30d";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type EarnRow = {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  /** Fraction. 0.05 is 5%. Null means the source did not publish a rate. */
  apy: number | null;
  window: string;
  chain: string;
  note: string;
  sign: boolean;
  tvlUsd: number;
};

type VaultMetric = { kvault?: string; apy?: string; tokensInvestedUsd?: string };
type ReserveMetric = { liquidityToken?: string; liquidityTokenMint?: string; supplyApy?: string; totalSupplyUsd?: string };

let cache: { at: number; rows: EarnRow[] } | null = null;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function apyText(row: EarnRow): string {
  if (row.apy == null || !(row.apy > 0)) return "—";
  return `${(row.apy * 100).toFixed(1)}%`;
}

export async function loadEarnBook(): Promise<EarnRow[]> {
  if (cache && Date.now() - cache.at < 120_000) return cache.rows;
  const [marinade, vaults, metrics, reserves] = await Promise.all([
    fetch(MARINADE, { signal: AbortSignal.timeout(12_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    loadKaminoVaults().catch(() => []),
    fetch(VAULT_METRICS, { signal: AbortSignal.timeout(14_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(MARKET, { signal: AbortSignal.timeout(12_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const msolApy = num((marinade as { value?: number } | null)?.value);
  const rows: EarnRow[] = VAULT_RECEIPTS.map((row) => ({
    id: `lst:${row.mint}`,
    name: row.name,
    symbol: row.symbol,
    mint: row.mint,
    apy: row.symbol === "mSOL" && msolApy > 0 ? msolApy : null,
    window: row.symbol === "mSOL" && msolApy > 0 ? "30d" : "receipt",
    chain: "Solana",
    note: row.note,
    sign: true,
    tvlUsd: 0,
  }));

  const byVault = new Map(vaults.map((v) => [v.address, v]));
  const metricRows = ((metrics as { result?: VaultMetric[] } | null)?.result ?? []) as VaultMetric[];
  for (const metric of metricRows) {
    const vault = byVault.get(metric.kvault ?? "");
    const apy = num(metric.apy);
    const tvl = num(metric.tokensInvestedUsd);
    if (!vault || vault.sharesMint.length < 32) continue;
    if (!(apy >= 0.01 && apy <= 0.35 && tvl >= 50_000)) continue;
    rows.push({
      id: `kvault:${vault.address}`,
      name: vault.name,
      symbol: vault.tokenMint === USDC ? "USDC" : "Share",
      mint: vault.sharesMint,
      apy,
      window: "APY",
      chain: "Solana",
      note: "Kamino vault share. Jupiter buys the share into this wallet. It is not a deposit into the vault program.",
      sign: true,
      tvlUsd: tvl,
    });
  }

  const seenMint = new Set<string>();
  const reserveRows = (Array.isArray(reserves) ? reserves : []) as ReserveMetric[];
  const ranked = reserveRows
    .map((row) => ({
      symbol: row.liquidityToken || "",
      mint: row.liquidityTokenMint || "",
      apy: num(row.supplyApy),
      tvl: num(row.totalSupplyUsd),
    }))
    .filter((row) => row.symbol && row.apy >= 0.005 && row.tvl >= 1_000_000)
    .sort((a, b) => b.apy - a.apy);
  for (const row of ranked) {
    if (seenMint.has(row.mint)) continue;
    seenMint.add(row.mint);
    rows.push({
      id: `reserve:${row.mint}`,
      name: row.symbol,
      symbol: row.symbol,
      mint: "",
      apy: row.apy,
      window: "supply",
      chain: "Solana",
      note: "Kamino supply rate. Buying the token does not enter this reserve, so there is no deposit button.",
      sign: false,
      tvlUsd: row.tvl,
    });
  }

  rows.sort((a, b) => Number(b.sign) - Number(a.sign) || (b.apy ?? -1) - (a.apy ?? -1));
  cache = { at: Date.now(), rows };
  return rows;
}
