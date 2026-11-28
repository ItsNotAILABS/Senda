/** Kamino builds the transaction. Phantom signs it. Senda does not hold the collateral. */

import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import { XSTOCKS_MARKET } from "@/lib/equities";
import { sendVersioned } from "@/lib/phantom";

const API = "https://api.kamino.finance";
export const KAMINO_MAIN = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";

export type KaminoReserve = {
  market: string;
  marketName: string;
  reserve: string;
  symbol: string;
  mint: string;
  maxLtv: number;
  borrowApy: number;
  supplyApy: number;
  totalSupplyUsd: number;
};

export type KaminoLoan = {
  id: string;
  market: string;
  collateral: string;
  debt: string;
  ltv: number;
};

type LoanInfo = {
  loanInfo?: {
    collateral?: { deposits?: Array<{ tokenName?: string; tokenAmount?: string }> };
    debt?: { borrows?: Array<{ tokenName?: string; tokenAmount?: string }> };
    currentLtv?: number;
  };
};

async function reserves(market: string, marketName: string): Promise<KaminoReserve[]> {
  const res = await fetch(`${API}/kamino-market/${market}/reserves/metrics`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Kamino ${res.status}`);
  const rows = (await res.json()) as Array<{
    reserve?: string;
    liquidityToken?: string;
    liquidityTokenMint?: string;
    maxLtv?: string;
    borrowApy?: string;
    supplyApy?: string;
    totalSupplyUsd?: string;
  }>;
  return rows
    .filter((row) => row.reserve && row.liquidityToken && row.liquidityTokenMint)
    .map((row) => ({
      market,
      marketName,
      reserve: row.reserve as string,
      symbol: row.liquidityToken as string,
      mint: row.liquidityTokenMint as string,
      maxLtv: Number(row.maxLtv) || 0,
      borrowApy: Number(row.borrowApy) || 0,
      supplyApy: Number(row.supplyApy) || 0,
      totalSupplyUsd: Number(row.totalSupplyUsd) || 0,
    }))
    .sort((a, b) => b.totalSupplyUsd - a.totalSupplyUsd);
}

export async function kaminoMarkets(): Promise<KaminoReserve[]> {
  const [main, stocks] = await Promise.all([
    reserves(KAMINO_MAIN, "Main"),
    reserves(XSTOCKS_MARKET, "xStocks"),
  ]);
  return [...stocks, ...main];
}

export async function kaminoLoans(owner: string): Promise<KaminoLoan[]> {
  const markets = [XSTOCKS_MARKET, KAMINO_MAIN];
  const found = await Promise.all(
    markets.map(async (market) => {
      const res = await fetch(`${API}/kamino-market/${market}/users/${owner}/obligations`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return [];
      const rows = (await res.json()) as Array<{ obligationAddress?: string }>;
      return (Array.isArray(rows) ? rows : [])
        .map((row) => row.obligationAddress)
        .filter((id): id is string => Boolean(id))
        .map((id) => ({ id, market }));
    }),
  );
  const loans = await Promise.all(
    found.flat().slice(0, 6).map(async ({ id, market }) => {
      const res = await fetch(`${API}/klend/loans/${id}`, { headers: { accept: "application/json" } });
      if (!res.ok) return { id, market, collateral: "—", debt: "—", ltv: 0 };
      const body = (await res.json()) as LoanInfo;
      const deposits = body.loanInfo?.collateral?.deposits ?? [];
      const borrows = body.loanInfo?.debt?.borrows ?? [];
      return {
        id,
        market,
        collateral: deposits.map((row) => `${Number(row.tokenAmount || 0).toFixed(4)} ${row.tokenName || ""}`).join(", ") || "none",
        debt: borrows.map((row) => `${Number(row.tokenAmount || 0).toFixed(2)} ${row.tokenName || ""}`).join(", ") || "none",
        ltv: Number(body.loanInfo?.currentLtv) || 0,
      };
    }),
  );
  return loans;
}

export async function signKamino(input: {
  action: "deposit" | "borrow" | "repay" | "withdraw";
  wallet: string;
  market: string;
  reserve: string;
  amount: string;
}): Promise<string> {
  const res = await fetch(`${API}/ktx/klend/${input.action}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      wallet: input.wallet,
      market: input.market,
      reserve: input.reserve,
      amount: input.amount,
    }),
  });
  const body = (await res.json()) as { transaction?: string; error?: string; message?: string };
  if (!res.ok || !body.transaction) throw new Error(body.message || body.error || "Kamino did not build that transaction.");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const tx = VersionedTransaction.deserialize(Buffer.from(body.transaction, "base64"));
  return sendVersioned(tx);
}
