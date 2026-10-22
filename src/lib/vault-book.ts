/** The Senda wrap is a claim. These are the vaults it sits beside. None of them take custody. */

export type Receipt = { symbol: string; name: string; mint: string; note: string };

/** Same mints as the stake rows in the offering register. Jupiter quotes them. The wallet signs. */
export const VAULT_RECEIPTS: Receipt[] = [
  { symbol: "JitoSOL", name: "Jito staked SOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", note: "SOL in. The token stays in the wallet." },
  { symbol: "mSOL", name: "Marinade SOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", note: "SOL in. The token stays in the wallet." },
  { symbol: "bSOL", name: "BlazeStake SOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", note: "SOL in. The token stays in the wallet." },
  { symbol: "JupSOL", name: "Jupiter staked SOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", note: "SOL in. The token stays in the wallet." },
  { symbol: "INF", name: "Sanctum INF", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", note: "A pool of staked SOL." },
];

export type KaminoVault = {
  address: string;
  name: string;
  sharesMint: string;
  tokenMint: string;
  perfBps: number;
  mgmtBps: number;
};

type RawVault = {
  address?: string;
  state?: { name?: string; sharesMint?: string; tokenMint?: string; performanceFeeBps?: number; managementFeeBps?: number };
};

let cache: { at: number; rows: KaminoVault[] } | null = null;

export async function loadKaminoVaults(): Promise<KaminoVault[]> {
  if (cache && Date.now() - cache.at < 120_000) return cache.rows;
  const res = await fetch("https://api.kamino.finance/kvaults/vaults", { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Kamino ${res.status}`);
  const json = (await res.json()) as RawVault[];
  const rows: KaminoVault[] = [];
  for (const row of json) {
    const name = row.state?.name?.trim() ?? "";
    const sharesMint = row.state?.sharesMint ?? "";
    const tokenMint = row.state?.tokenMint ?? "";
    if (!row.address || !name || sharesMint.length < 32) continue;
    rows.push({
      address: row.address,
      name,
      sharesMint,
      tokenMint,
      perfBps: Number(row.state?.performanceFeeBps) || 0,
      mgmtBps: Number(row.state?.managementFeeBps) || 0,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  cache = { at: Date.now(), rows };
  return rows;
}
